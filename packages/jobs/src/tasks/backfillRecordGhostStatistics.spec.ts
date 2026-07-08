import { beforeEach, describe, expect, mock, test } from 'bun:test'

const getRecordIdsWithGhostMedia = mock(async (_ids: number[]) => [] as number[])
const getRecordMediaForStatisticBackfill = mock(async () => [])
const upsertRecordStatistic = mock(async () => {})

mock.module('@zeepkist/database/services', () => ({
	getRecordIdsWithGhostMedia,
	getRecordMediaForStatisticBackfill,
	upsertRecordStatistic,
}))

const { backfillRecordGhostStatistics } = await import('./backfillRecordGhostStatistics')

function createHelpers() {
	return {
		addJob: mock(async () => {}),
		addJobs: mock(async () => {}),
		logger: {
			info: mock(() => {}),
			warn: mock(() => {}),
		},
	}
}

describe('backfillRecordGhostStatistics', () => {
	beforeEach(() => {
		getRecordIdsWithGhostMedia.mockReset()
		getRecordMediaForStatisticBackfill.mockReset()
		upsertRecordStatistic.mockReset()
	})

	test('targeted backfill skips records without ghost media before enqueueing batches', async () => {
		getRecordIdsWithGhostMedia.mockResolvedValue([1, 3])
		const helpers = createHelpers()

		await backfillRecordGhostStatistics({ ids: [1, 2, 3] }, helpers as never)

		expect(getRecordIdsWithGhostMedia).toHaveBeenCalledWith([1, 2, 3])
		expect(helpers.addJobs).toHaveBeenCalledWith([
			{
				identifier: 'backfillRecordGhostStatisticsBatch',
				payload: { ids: [1, 3] },
				jobKey: 'backfill-record-ghost-statistics:1-3',
			},
		])
		expect(helpers.logger.info).toHaveBeenCalledWith(
			'Enqueued targeted record ghost statistics backfill.',
			{
				requested: 3,
				count: 2,
				batches: 1,
			},
		)
	})

	test('targeted backfill does not enqueue empty batches when no records have ghost media', async () => {
		getRecordIdsWithGhostMedia.mockResolvedValue([])
		const helpers = createHelpers()

		await backfillRecordGhostStatistics({ ids: [2] }, helpers as never)

		expect(helpers.addJobs).not.toHaveBeenCalled()
		expect(helpers.logger.info).toHaveBeenCalledWith(
			'Enqueued targeted record ghost statistics backfill.',
			{
				requested: 1,
				count: 0,
				batches: 0,
			},
		)
	})
})
