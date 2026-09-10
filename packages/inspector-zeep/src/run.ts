import {
	findSubmissionRound,
	freezeSubmissionContest,
	getContestSubmissions,
	getSubmissionContest,
	getSubmissionPlaylist,
	getSubmissionValidation,
	linkSubmissionRound,
	publishSubmissionPlaylist,
	reconcileContestSubmissions,
	saveSubmissionContest,
	saveSubmissionValidation,
	setSubmissionRetry,
	submissionDigest,
	uploadSubmissionObject,
	type ValidationRow,
	withInspectorLock,
} from '@zeepkist/database/services/level-submissions'
import { findLevelPaths, SteamCmdDownloader, SteamWebApiMetadata } from '@zeepkist/workshop'
import type { InspectorConfig } from './config'
import { parseContestTitle } from './contests/matching'
import { DiscordRest, type ForumThread } from './discord/client'
import { publishDiscordPlaylist } from './discord/publication'
import { createSubmissionPlaylist } from './playlists/create'
import { reconcileSources, type SourceSubmission } from './submissions/reconcile'
import { inspectLevel, sha256, VALIDATOR_VERSION } from './validation/validate'

export interface RunOptions {
	appId: string
	discordToken: string
	dryRun: boolean
	force: boolean
	signal: AbortSignal
	steamApiKey: string
	steamcmd: string
}
export async function runInspector(config: InspectorConfig, options: RunOptions) {
	const discord = new DiscordRest(options.discordToken, options.signal)
	const metadata = new SteamWebApiMetadata(
		options.steamApiKey,
		options.appId,
		undefined,
		options.signal,
	)
	const downloader = new SteamCmdDownloader(options.appId, options.steamcmd, options.signal)
	return withInspectorLock(async () => {
		const bot = await discord.request<{ id: string }>('/users/@me')
		const discovered = new Map<string, ForumThread>()
		for (const forum of config.forums) {
			for (const thread of await discord.discover(forum.guildId, forum.forumId))
				discovered.set(thread.id, thread)
		}
		let failed = false
		for (const configured of config.contests) {
			options.signal.throwIfAborted()
			try {
				const thread =
					discovered.get(configured.threadId) ??
					(await discord.request<ForumThread>(`/channels/${configured.threadId}`))
				if (
					!config.forums.some(
						(f) => f.guildId === thread.guild_id && f.forumId === thread.parent_id,
					)
				)
					throw new Error('Thread outside configured forum')
				const parsed = parseContestTitle(thread.name)
				if (!parsed) throw new Error('Unrecognized contest title')
				let contest = await getSubmissionContest(thread.id)
				const matchedRound = await findSubmissionRound(
					config.seasons[String(parsed.season)],
					parsed.round,
					configured.roundId,
				)
				const changedIdentity =
					contest &&
					(contest.seasonNumber !== parsed.season || contest.roundNumber !== parsed.round)
				if (changedIdentity && !configured.roundId)
					throw new Error(
						'Contest title changed round identity; explicit mapping required',
					)
				const rulesHash = submissionDigest(configured.rules)
				if (options.dryRun) {
					const messages = await discord.messages(thread.id)
					console.info(
						`Inspector preview: ${messages.length} source messages; round ${matchedRound ? 'matched' : 'unlinked'}; rules ${contest?.rulesHash === rulesHash ? 'unchanged' : 'changed'}.`,
					)
					continue
				}
				if (contest && matchedRound && (!contest.idZslRound || configured.roundId)) {
					await linkSubmissionRound(contest.id, matchedRound, Boolean(configured.roundId))
				}
				if (
					contest &&
					(configured.closed ||
						thread.thread_metadata.locked ||
						(contest.state === 'frozen' && !configured.reopen))
				) {
					await freezeSubmissionContest(contest.id, true)
					const frozen = await getSubmissionPlaylist(thread.id)
					if (frozen) {
						const output = createSubmissionPlaylist(contest.theme, frozen.members)
						await publishDiscordPlaylist(
							discord,
							bot.id,
							contest,
							frozen.playlist,
							output.json,
							await discord.messages(thread.id),
						)
					}
					continue
				}
				if (configured.closed || thread.thread_metadata.locked) continue
				contest = await saveSubmissionContest({
					threadId: thread.id,
					guildId: thread.guild_id,
					forumId: thread.parent_id,
					title: thread.name,
					theme: parsed.theme,
					seasonNumber: parsed.season,
					roundNumber: parsed.round,
					idZslRound: configured.roundId
						? (matchedRound ?? contest?.idZslRound)
						: (contest?.idZslRound ?? matchedRound),
					mappingSource: configured.roundId
						? 'explicit'
						: matchedRound
							? 'title'
							: 'unlinked',
					rules: configured.rules,
					rulesHash,
					state: 'open',
					frozenAt: null,
				})
				const messages = await discord.messages(thread.id)
				const previous = await getContestSubmissions(contest.id)
				const sources = reconcileSources(messages, previous as SourceSubmission[])
				const selected = await reconcileContestSubmissions(
					contest.id,
					sources.map((s) => ({
						...s,
						idContest: contest!.id,
						lastSeen: new Date().toISOString(),
					})),
				)
				const ids = [
					...new Set(selected.filter((s) => !s.sourceError).map((s) => s.workshopId)),
				]
				const details = new Map<
					bigint,
					Awaited<ReturnType<typeof metadata.getItems>>[number]
				>()
				for (let i = 0; i < ids.length; i += 100)
					for (const item of await metadata.getItems(ids.slice(i, i + 100)))
						details.set(item.workshopId, item)
				const accepted: { validation: ValidationRow; workshopId: bigint }[] = []
				let complete = true
				const results = new Map<string, boolean>()
				for (const submission of selected) {
					options.signal.throwIfAborted()
					try {
						const item = details.get(submission.workshopId)
						if (
							!submission.sourceError &&
							(!item?.available ||
								!item.updatedAt ||
								item.updatedAt.startsWith('1970-'))
						)
							throw new Error('workshop-metadata-unavailable')
						let validation = await getSubmissionValidation(
							submission.latestValidationId,
						)
						if (
							options.force ||
							!validation ||
							validation.failures.includes('multiple-workshop-links') !==
								Boolean(submission.sourceError) ||
							validation.rulesHash !== rulesHash ||
							validation.validatorVersion !== VALIDATOR_VERSION ||
							validation.workshopUpdatedAt !== (item?.updatedAt ?? 'source-error') ||
							validation.workshopFileSize !== (item?.fileSize ?? 0)
						) {
							let inspection: ReturnType<typeof inspectLevel> | undefined
							let rawHash: string | undefined
							let failures: string[] = submission.sourceError
								? [submission.sourceError]
								: []
							if (!submission.sourceError) {
								await using download = await downloader.download([
									submission.workshopId,
								])
								options.signal.throwIfAborted()
								const directory = download.items.find(
									(i) => i.workshopId === submission.workshopId,
								)?.directory
								if (!directory) throw new Error('workshop-download-unavailable')
								const paths = await findLevelPaths(directory)
								if (paths.length !== 1)
									failures = [
										paths.length
											? 'multiple-level-files'
											: 'missing-level-file',
									]
								else {
									const file = Bun.file(paths[0]!)
									if (file.size > 64 * 1024 * 1024) failures = ['level-too-large']
									else {
										const bytes = new Uint8Array(await file.arrayBuffer())
										rawHash = sha256(bytes)
										try {
											const content = new TextDecoder('utf-8', {
												fatal: true,
												ignoreBOM: true,
											}).decode(bytes)
											inspection = inspectLevel(
												content,
												paths[0]!
													.split(/[\\/]/)
													.pop()!
													.replace(/\.zeeplevel$/i, ''),
												configured.rules,
											)
											failures = inspection.failures
										} catch {
											failures = ['malformed-level']
										}
									}
								}
								const [after] = await metadata.getItems([submission.workshopId])
								if (
									!after?.available ||
									after.updatedAt !== item!.updatedAt ||
									after.fileSize !== item!.fileSize
								)
									throw new Error('workshop-revision-changed')
							}
							const payload =
								inspection && !failures.length
									? {
											...inspection.payload,
											objectKey: `inspector/payloads/${inspection.payload.sha256}.gz`,
										}
									: undefined
							if (payload)
								await uploadSubmissionObject(
									payload.objectKey,
									inspection!.data,
									'application/gzip',
								)
							validation = await saveSubmissionValidation({
								idSubmission: submission.id,
								workshopUpdatedAt: item?.updatedAt ?? 'source-error',
								workshopFileSize: item?.fileSize ?? 0,
								contentSha256: rawHash,
								validatorVersion: VALIDATOR_VERSION,
								rulesHash,
								fileUid: inspection?.payload.uid,
								measurements: inspection?.measurements ?? {},
								failures,
								valid: failures.length === 0,
								payload,
							})
						}
						results.set(
							submission.messageId,
							(results.get(submission.messageId) ?? true) && validation.valid,
						)
						if (validation.valid)
							accepted.push({ validation, workshopId: submission.workshopId })
					} catch {
						complete = false
						failed = true
						await setSubmissionRetry(submission.id, 'inspection-transient')
						console.warn('Inspector submission deferred; previous playlist retained.')
					}
				}
				for (const message of messages)
					if (!message.author.bot) {
						const current = sources.filter((s) => s.messageId === message.id)
						if (
							!current.some((s) => s.state === 'selected') &&
							(current.length || previous.some((s) => s.messageId === message.id))
						)
							await discord.reaction(thread.id, message, undefined)
						else if (results.has(message.id))
							await discord.reaction(thread.id, message, results.get(message.id))
					}
				if (!complete) continue
				accepted.sort((a, b) => {
					const left = selected.find((s) => s.id === a.validation.idSubmission)!
					const right = selected.find((s) => s.id === b.validation.idSubmission)!
					return (
						left.messageCreatedAt.localeCompare(right.messageCreatedAt) ||
						(left.id < right.id ? -1 : 1)
					)
				})
				const output = createSubmissionPlaylist(parsed.theme, accepted)
				const current = await getSubmissionPlaylist(thread.id)
				const objectKey = `inspector/playlists/${thread.id}/${output.digest}.zeeplist`
				let version = current?.playlist
				if (version?.digest !== output.digest) {
					await uploadSubmissionObject(
						objectKey,
						new TextEncoder().encode(output.json),
						'application/json',
					)
					version = await publishSubmissionPlaylist(
						contest.id,
						output.digest,
						objectKey,
						output.members.map((m) => ({
							idValidation: m.validation.id,
							workshopId: m.workshopId,
						})),
					)
				}
				await publishDiscordPlaylist(
					discord,
					bot.id,
					contest,
					version!,
					output.json,
					messages,
				)
				console.info(
					`Inspector contest complete: ${output.members.length} valid submissions.`,
				)
			} catch {
				failed = true
				console.warn(
					'Inspector contest failed; publication deferred. Check configuration and service availability.',
				)
			}
		}
		if (failed) throw new Error('Inspector run completed with deferred work')
	})
}
