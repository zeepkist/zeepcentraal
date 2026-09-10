import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
	ContestRow,
	SubmissionRow,
	ValidationRow,
} from '@zeepkist/database/services/level-submissions'
import { configSchema } from './config'
import type { SourceMessage } from './submissions/reconcile'

let directory: string
let contest: ContestRow | undefined
let rows: SubmissionRow[] = []
let validations: ValidationRow[] = []
let downloads = 0
let posts = 0
let writes = 0
let completeFetch = true
let locked = false
let multiFile = false
let metadataAvailable = true
let revision = '2026-09-10T00:00:00.000Z'
let messages: SourceMessage[] = []
let playlist: { id: bigint; digest: string; validCount: number; dateCreated: string } | undefined
let members: { validation: ValidationRow; workshopId: bigint }[] = []
const digest = (value: unknown) =>
	new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex')
mock.module('@zeepkist/database/services/level-submissions', () => ({
	withInspectorLock: (fn: () => Promise<unknown>) => fn(),
	submissionDigest: digest,
	findSubmissionRound: async () => 1,
	linkSubmissionRound: async (_id: bigint, round: number) => {
		if (contest) contest.idZslRound = round
	},
	getSubmissionContest: async () => contest,
	saveSubmissionContest: async (input: Partial<ContestRow>) => {
		writes++
		contest = { id: 1n, publication: {}, ...contest, ...input } as ContestRow
		return contest
	},
	freezeSubmissionContest: async (_id: bigint, value: boolean) => {
		contest!.state = value ? 'frozen' : 'open'
	},
	getContestSubmissions: async () => rows,
	reconcileContestSubmissions: async (_id: bigint, incoming: Partial<SubmissionRow>[]) => {
		const previous = rows
		rows = incoming.map((row, i) => ({
			id: BigInt(i + 1),
			latestValidationId: null,
			...previous.find(
				(p) => p.messageId === row.messageId && p.workshopId === row.workshopId,
			),
			...row,
		})) as SubmissionRow[]
		return rows.filter((r) => r.state === 'selected')
	},
	getSubmissionValidation: async (id: bigint) => validations.find((v) => v.id === id),
	saveSubmissionValidation: async (input: Partial<ValidationRow>) => {
		writes++
		const row = { ...input, id: BigInt(validations.length + 1) } as ValidationRow
		validations.push(row)
		rows.find((r) => r.id === row.idSubmission)!.latestValidationId = row.id
		return row
	},
	setSubmissionRetry: async () => {},
	uploadSubmissionObject: async () => {
		writes++
	},
	publishSubmissionPlaylist: async (
		_id: bigint,
		hash: string,
		_key: string,
		input: { idValidation: bigint; workshopId: bigint }[],
	) => {
		writes++
		playlist = { id: 1n, digest: hash, validCount: input.length, dateCreated: revision }
		members = input.map((m) => ({
			validation: validations.find((v) => v.id === m.idValidation)!,
			workshopId: m.workshopId,
		}))
		return playlist
	},
	getSubmissionPlaylist: async () => (playlist ? { contest, playlist, members } : undefined),
	saveSubmissionPublication: async (_id: bigint, value: ContestRow['publication']) => {
		contest!.publication = { ...value }
	},
}))
mock.module('@zeepkist/workshop', () => ({
	SteamWebApiMetadata: class {
		async getItems(ids: bigint[]) {
			return ids.map((workshopId) => ({
				workshopId,
				available: metadataAvailable,
				updatedAt: revision,
				fileSize: 100,
			}))
		}
	},
	SteamCmdDownloader: class {
		async download(ids: bigint[]) {
			downloads++
			return {
				items: ids.map((workshopId) => ({ workshopId, directory })),
				async [Symbol.asyncDispose]() {},
			}
		}
	},
	findLevelPaths: async () =>
		multiFile
			? [join(directory, 'level.zeeplevel'), join(directory, 'other.zeeplevel')]
			: [join(directory, 'level.zeeplevel')],
}))
mock.module('./discord/client', () => ({
	DiscordRest: class {
		async request<T>(path: string, method = 'GET', body?: FormData): Promise<T> {
			if (path === '/users/@me') return { id: '999' } as T
			if (method === 'POST') {
				posts++
				const payload = JSON.parse(body!.get('payload_json') as string)
				expect(payload.flags).toBe(1 << 15)
				expect(payload.components[0].components[1].file.url).toStartWith('attachment://')
				return { id: String(1000 + posts) } as T
			}
			return undefined as T
		}
		async discover() {
			return [
				{
					id: '10',
					guild_id: '1',
					parent_id: '2',
					name: 'S8R1 Mixed Surfaces',
					thread_metadata: { locked, archived: false },
				},
			]
		}
		async messages() {
			if (!completeFetch) throw new Error('pagination interrupted')
			return messages
		}
		async reaction() {}
	},
}))
const { runInspector } = await import('./run')
const config = () =>
	configSchema.parse({
		version: 1,
		forums: [{ guildId: '1', forumId: '2' }],
		seasons: { 8: 1 },
		contests: [
			{
				threadId: '10',
				rules: {
					minBlocks: 0,
					maxBlocks: 3000,
					minTime: 25,
					maxTime: 60,
					minCheckpoints: 0,
				},
			},
		],
	})
const options = () => ({
	dryRun: false,
	force: false,
	signal: new AbortController().signal,
	discordToken: 'fake',
	steamApiKey: 'fake',
	appId: '1440670',
	steamcmd: 'fake',
})
beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), 'inspector-test-'))
	await Bun.write(
		join(directory, 'level.zeeplevel'),
		JSON.stringify({
			level: { UID: 'fixture' },
			author: { name: 'Fixture', StmID: '76561198000000001' },
			medals: { author: 40 },
			blox: [],
		}),
	)
})
afterAll(async () => {
	await rm(directory, { recursive: true, force: true })
})
beforeEach(() => {
	contest = undefined
	rows = []
	validations = []
	downloads = posts = writes = 0
	completeFetch = metadataAvailable = true
	locked = multiFile = false
	playlist = undefined
	members = []
	revision = '2026-09-10T00:00:00.000Z'
	messages = [
		{
			id: '20',
			content: 'https://steamcommunity.com/sharedfiles/filedetails/?id=123',
			author: { id: '42' },
			timestamp: revision,
			edited_timestamp: null,
		},
	]
})
test('unchanged revisions skip download and publication; force only bypasses validation cache', async () => {
	await runInspector(config(), options())
	await runInspector(config(), options())
	expect(downloads).toBe(1)
	expect(posts).toBe(1)
	expect(playlist?.validCount).toBe(1)
	await runInspector(config(), { ...options(), force: true })
	expect(downloads).toBe(2)
	expect(posts).toBe(1)
})
test('changed rules invalidate cache and remove invalid levels from playlist', async () => {
	await runInspector(config(), options())
	const updated = config()
	updated.contests[0]!.rules.minCheckpoints = 3
	await runInspector(updated, options())
	expect(downloads).toBe(2)
	expect(posts).toBe(2)
	expect(playlist?.validCount).toBe(0)
})
test('multi-file items are invalid and invalid results are cacheable', async () => {
	multiFile = true
	await runInspector(config(), options())
	await runInspector(config(), options())
	expect(validations[0]?.failures).toEqual(['multiple-level-files'])
	expect(downloads).toBe(1)
	expect(playlist?.validCount).toBe(0)
})
test('partial fetch and unavailable Workshop metadata retain previous complete publication', async () => {
	await runInspector(config(), options())
	const previous = playlist?.digest
	completeFetch = false
	await expect(runInspector(config(), options())).rejects.toThrow()
	completeFetch = true
	metadataAvailable = false
	await expect(runInspector(config(), options())).rejects.toThrow()
	expect(playlist?.digest).toBe(previous)
	expect(posts).toBe(1)
})
test('freeze preserves old payload and stops following Workshop revisions', async () => {
	await runInspector(config(), options())
	if (contest) contest.idZslRound = null
	locked = true
	revision = '2026-09-11T00:00:00.000Z'
	await runInspector(config(), options())
	expect(contest?.state).toBe('frozen')
	expect(contest?.idZslRound).toBe(1)
	expect(downloads).toBe(1)
	expect(posts).toBe(1)
})
test('dry run makes no persistent writes, downloads, or Discord posts', async () => {
	await runInspector(config(), { ...options(), dryRun: true })
	expect(writes).toBe(0)
	expect(downloads).toBe(0)
	expect(posts).toBe(0)
})
test('removal publishes empty playlist rather than retaining stale membership', async () => {
	await runInspector(config(), options())
	messages = []
	await runInspector(config(), options())
	expect(playlist?.validCount).toBe(0)
	expect(posts).toBe(2)
})
