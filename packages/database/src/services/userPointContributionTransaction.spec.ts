import { expect, mock, test } from 'bun:test'

const lockQueries: unknown[] = []
const insertBatchSizes: number[] = []
const execute = mock(async (query: unknown) => {
	lockQueries.push(query)
})
const select = mock(() => ({
	from: () => ({
		where: () => ({
			orderBy: async () => [],
		}),
	}),
}))
const deleteRows = mock(() => ({ where: async () => {} }))
const insert = mock(() => ({
	values: async (rows: unknown[]) => {
		insertBatchSizes.push(rows.length)
		if (insertBatchSizes.length === 2) throw new Error('insert failed')
	},
}))
const tx = { delete: deleteRows, execute, insert, select }
const transaction = mock(async (callback: (value: typeof tx) => Promise<void>) => callback(tx))

mock.module('../client', () => ({ db: { transaction } }))

const { upsertUserPointContributionsBulk } = await import('./userPointContribution')

test('locks affected users and propagates chunk failure for transaction rollback', async () => {
	const contributions = Array.from({ length: 501 }, (_, index) => ({
		contributionRank: index + 1,
		idLevel: index + 1,
		idRecord: index + 1000,
		levelDecayedPoints: 100,
		levelPoints: 100,
		levelPosition: 1,
		playerDecayedPoints: 100,
	}))

	await expect(
		upsertUserPointContributionsBulk([
			{ idUser: 9, contributions },
			{ idUser: 2, contributions: [] },
		]),
	).rejects.toThrow('insert failed')

	expect(transaction).toHaveBeenCalledTimes(1)
	expect(lockQueries).toHaveLength(2)
	expect(insertBatchSizes).toEqual([500, 1])
})
