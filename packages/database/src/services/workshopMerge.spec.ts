import { beforeEach, describe, expect, mock, test } from 'bun:test'

const selectResults: unknown[][] = []

function createSelectBuilder() {
	const builder = {
		from: mock(() => builder),
		where: mock(() => builder),
		orderBy: mock(() => builder),
		limit: mock(() => builder),
		// biome-ignore lint/suspicious/noThenProperty: Drizzle query builders are thenable.
		then: mock((resolve: (rows: unknown[]) => unknown) =>
			Promise.resolve(resolve(selectResults.shift() ?? [])),
		),
	}
	return builder
}

function createWhereBuilder() {
	return {
		where: mock(async () => {}),
	}
}

const tx = {
	select: mock(() => createSelectBuilder()),
	update: mock(() => ({
		set: mock(() => createWhereBuilder()),
	})),
	delete: mock(() => createWhereBuilder()),
	execute: mock(async () => {}),
}

const db = {
	transaction: mock(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
		callback(tx),
	),
}

mock.module('../client', () => ({
	db,
}))

mock.module('./user', () => ({
	resolveSteamNameForWorkshopAuthor: async () => 'Author',
}))

const lockWorldRecordCounts = mock(async () => {})
const lockWorldRecords = mock(async () => {})
const refreshUserWorldRecordCounts = mock(async () => {})

mock.module('./scoreLocks', () => ({ lockWorldRecordCounts, lockWorldRecords }))
mock.module('./worldRecordCounts', () => ({ refreshUserWorldRecordCounts }))

const { mergeZeepSdkExponentHash } = await import('./workshop')

describe('mergeZeepSdkExponentHash', () => {
	beforeEach(() => {
		selectResults.length = 0
		db.transaction.mockClear()
		tx.select.mockClear()
		tx.update.mockClear()
		tx.delete.mockClear()
		tx.execute.mockClear()
		lockWorldRecordCounts.mockClear()
		lockWorldRecords.mockClear()
		refreshUserWorldRecordCounts.mockClear()
	})

	test('moves records, rebuilds derived rows, and deletes empty bad level', async () => {
		selectResults.push(
			[{ id: 10 }],
			[{ id: 20 }],
			[{ idUser: 2 }, { idUser: 1 }],
			[{ idUser: 3 }],
			[{ count: 0 }],
		)

		const result = await mergeZeepSdkExponentHash({
			correctLevelId: 10,
			correctXxHash: 'CORRECT',
			badXxHash: 'BAD',
			workshopId: 1n,
			fileUid: 'uid',
		})

		expect(result).toEqual({ merged: true, changedLevelIds: [10] })
		expect(tx.update).toHaveBeenCalledTimes(3)
		expect(tx.delete).toHaveBeenCalledTimes(3)
		expect(tx.execute).toHaveBeenCalledTimes(7)
		expect(lockWorldRecords).toHaveBeenCalledWith(tx, [10, 20])
		expect(lockWorldRecordCounts).toHaveBeenCalledWith(tx, [1, 2, 3])
		expect(refreshUserWorldRecordCounts).toHaveBeenCalledWith(tx, [1, 2, 3])
	})
})
