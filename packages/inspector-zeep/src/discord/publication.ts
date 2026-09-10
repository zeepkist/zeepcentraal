import {
	type ContestRow,
	saveSubmissionPublication,
} from '@zeepkist/database/services/level-submissions'
import type { SourceMessage } from '../submissions/reconcile'
import type { DiscordRest } from './client'

export function playlistMessage(filename: string, validCount: number, updatedAt: string) {
	return {
		flags: 1 << 15,
		allowed_mentions: { parse: [] },
		components: [
			{
				type: 17,
				components: [
					{
						type: 10,
						content: `## Level contest submissions\n${validCount} valid submissions · Updated <t:${Math.floor(Date.parse(updatedAt) / 1000)}:R>`,
					},
					{ type: 13, file: { url: `attachment://${filename}` } },
				],
			},
		],
	}
}
export async function publishDiscordPlaylist(
	discord: DiscordRest,
	botId: string,
	contest: ContestRow,
	version: { digest: string; validCount: number; dateCreated: string },
	json: string,
	messages: SourceMessage[],
) {
	const filename = `contest-${contest.threadId}-${version.digest}.zeeplist`
	const publication = { ...contest.publication }
	if (publication.digest !== version.digest || !publication.messageId) {
		// Recover a successful POST followed by a process crash before DB persistence.
		const recovered = messages.find(
			(m) => m.author.id === botId && m.attachments?.some((a) => a.filename === filename),
		)
		let messageId = recovered?.id
		if (!messageId) {
			const form = new FormData()
			form.set(
				'payload_json',
				JSON.stringify(playlistMessage(filename, version.validCount, version.dateCreated)),
			)
			form.set('files[0]', new Blob([json], { type: 'application/json' }), filename)
			messageId = (
				await discord.request<{ id: string }>(
					`/channels/${contest.threadId}/messages`,
					'POST',
					form,
				)
			).id
		}
		publication.cleanupIds = [
			...new Set([
				...(publication.cleanupIds ?? []),
				...(publication.messageId ? [publication.messageId] : []),
			]),
		].filter((id) => id !== messageId)
		publication.messageId = messageId
		publication.digest = version.digest
		await saveSubmissionPublication(contest.id, publication)
	}
	for (const id of [...(publication.cleanupIds ?? [])]) {
		const old = messages.find((m) => m.id === id)
		// Complete source pagination proves absence. Never delete other bot/user messages.
		if (old && old.author.id === botId)
			await discord.request(`/channels/${contest.threadId}/messages/${id}`, 'DELETE')
		publication.cleanupIds = publication.cleanupIds!.filter((candidate) => candidate !== id)
		await saveSubmissionPublication(contest.id, publication)
	}
}
