import { beforeEach, expect, mock, test } from 'bun:test'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const selectRows: unknown[][] = []
const insertRows: unknown[][] = []
let condition: SQL | undefined
const set = mock(() => ({ where: async () => {} }))

const executor = {
	select: mock(() => {
		const result = Promise.resolve(selectRows.shift() ?? [])
		const builder = Object.assign(result, {
			from: () => builder,
			where: (value: SQL) => {
				condition = value
				return builder
			},
			limit: () => result,
			for: () => result,
		})
		return builder
	}),
	insert: mock(() => {
		const builder = {
			values: () => builder,
			onConflictDoUpdate: () => builder,
			onConflictDoNothing: () => builder,
			returning: async () => insertRows.shift() ?? [],
		}
		return builder
	}),
	update: mock(() => ({ set })),
}
const db = {
	...executor,
	transaction: async <T>(callback: (transaction: typeof executor) => Promise<T>): Promise<T> =>
		callback(executor),
}

mock.module('../../client', () => ({ client: {}, db }))
mock.module('../../s3', () => ({ downloadFile: mock(), uploadFile: mock() }))

const {
	findSubmissionRound,
	publishSubmissionPlaylist,
	saveSubmissionContest,
	saveSubmissionValidation,
} = await import('./index')

beforeEach(() => {
	selectRows.length = 0
	insertRows.length = 0
	condition = undefined
	db.select.mockClear()
	db.insert.mockClear()
	db.update.mockClear()
	set.mockClear()
})

test('round lookup skips missing mappings and rejects ambiguous matches', async () => {
	expect(await findSubmissionRound(undefined, 1)).toBeUndefined()
	expect(db.select).not.toHaveBeenCalled()
	selectRows.push([{ id: 7 }, { id: 8 }], [], [{ id: 7 }])
	expect(await findSubmissionRound(2, 1)).toBeUndefined()
	expect(await findSubmissionRound(2, 1)).toBeUndefined()
	expect(await findSubmissionRound(2, 1)).toBe(7)
	expect(condition).toBeDefined()
	const query = new PgDialect().sqlToQuery(condition as SQL)
	expect(query.params).toEqual([2, 1])
})

test('explicit round mapping takes precedence without requiring season', async () => {
	selectRows.push([{ id: 9 }])
	expect(await findSubmissionRound(undefined, 1, 9)).toBe(9)
	expect(condition).toBeDefined()
	const query = new PgDialect().sqlToQuery(condition as SQL)
	expect(query.params).toEqual([9])
})

test('contest save rejects missing returned row', async () => {
	await expect(
		saveSubmissionContest({
			threadId: 'thread',
			guildId: 'guild',
			forumId: 'forum',
			title: 'Contest',
			theme: 'Theme',
			seasonNumber: 1,
			roundNumber: 1,
			mappingSource: 'title',
			rules: {},
			rulesHash: 'rules-hash',
		}),
	).rejects.toThrow('Submission contest was not returned')
})

test('missing validation row cannot clear retry state or update validation pointer', async () => {
	await expect(
		saveSubmissionValidation({
			idSubmission: 1n,
			workshopUpdatedAt: '2026-10-01T00:00:00Z',
			workshopFileSize: 1,
			validatorVersion: '1',
			rulesHash: 'rules-hash',
			measurements: {},
			failures: [],
			valid: true,
		}),
	).rejects.toThrow('Submission validation was not returned')
	expect(db.update).not.toHaveBeenCalled()
})

test('missing playlist after conflict cannot change current playlist pointer', async () => {
	selectRows.push([{ id: 1n, state: 'open' }], [])
	await expect(
		publishSubmissionPlaylist(1n, 'digest', 'inspector/playlist.json', []),
	).rejects.toThrow('Submission playlist was not returned')
	expect(db.update).not.toHaveBeenCalled()
})

test('existing playlist after conflict stays reusable', async () => {
	const playlist = {
		id: 3n,
		idContest: 1n,
		digest: 'digest',
		objectKey: 'inspector/playlist.json',
		validCount: 0,
		dateCreated: '2026-10-01T00:00:00Z',
	}
	selectRows.push([{ id: 1n, state: 'open' }], [playlist])
	expect(await publishSubmissionPlaylist(1n, 'digest', 'inspector/playlist.json', [])).toBe(
		playlist,
	)
	expect(db.insert).toHaveBeenCalledTimes(1)
	expect(set).toHaveBeenCalledWith({
		currentPlaylistId: 3n,
		dateUpdated: expect.any(String),
	})
})
