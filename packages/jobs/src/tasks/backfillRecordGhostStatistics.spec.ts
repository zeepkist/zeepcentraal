import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const getRecordIdsWithGhostMedia = mock(async (_ids: number[]) => [] as number[])
const getRecordMediaForStatisticBackfill = mock(
	async () => [] as Array<{ idRecord: number; ghostUrl: string | null }>,
)
const upsertRecordStatistic = mock(async () => {})
const parseGhostStatistics = mock(async () => ({
	ghostVersion: 6,
	hasInputData: true,
	hasAirData: true,
	hasWheelData: true,
	hasSlipData: true,
	hasStateData: true,
	hasSurfaceData: true,
	hasVelocityData: true,
	hasRagdollData: true,
	timeAnyDriverInput: 1,
	driverInputTransitionCount: 2,
}))

mock.module('@zeepkist/database/services', () => ({
	getRecordIdsWithGhostMedia,
	getRecordMediaForStatisticBackfill,
	upsertRecordStatistic,
}))

mock.module('@zeepkist/core/ghosts', () => ({ parseGhostStatistics }))

const { backfillRecordGhostStatistics, backfillRecordGhostStatisticsBatch } = await import(
	'./backfillRecordGhostStatistics'
)

const blockedFetch = globalThis.fetch

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
		parseGhostStatistics.mockReset()
		parseGhostStatistics.mockResolvedValue({
			ghostVersion: 6,
			hasInputData: true,
			hasAirData: true,
			hasWheelData: true,
			hasSlipData: true,
			hasStateData: true,
			hasSurfaceData: true,
			hasVelocityData: true,
			hasRagdollData: true,
			timeAnyDriverInput: 1,
			driverInputTransitionCount: 2,
		})
		globalThis.fetch = mock(async () => new Response(new Uint8Array([1, 2, 3]))) as never
	})

	afterEach(() => {
		globalThis.fetch = blockedFetch
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

	test('normal backfill cursor-paginates incomplete statistics from highest ID to lowest', async () => {
		getRecordMediaForStatisticBackfill
			.mockResolvedValueOnce([
				{ idRecord: 5, ghostUrl: 'ghosts/5.bin' },
				{ idRecord: 2, ghostUrl: 'ghosts/2.bin' },
			])
			.mockResolvedValueOnce([{ idRecord: 1, ghostUrl: 'ghosts/1.bin' }])
		const helpers = createHelpers()

		await backfillRecordGhostStatistics({ limit: 2 }, helpers as never)

		expect(getRecordMediaForStatisticBackfill).toHaveBeenNthCalledWith(1, {
			beforeId: undefined,
			limit: 2,
		})
		expect(getRecordMediaForStatisticBackfill).toHaveBeenNthCalledWith(2, {
			beforeId: 2,
			limit: 2,
		})
		expect(helpers.addJob).toHaveBeenNthCalledWith(
			1,
			'backfillRecordGhostStatisticsBatch',
			{ ids: [5, 2] },
			{ jobKey: 'backfill-record-ghost-statistics:5-2' },
		)
		expect(helpers.addJob).toHaveBeenNthCalledWith(
			2,
			'backfillRecordGhostStatisticsBatch',
			{ ids: [1] },
			{ jobKey: 'backfill-record-ghost-statistics:1-1' },
		)
	})

	test('V5 repair cursor-paginates only V5 rows with distinct batch job keys', async () => {
		getRecordMediaForStatisticBackfill
			.mockResolvedValueOnce([
				{ idRecord: 9, ghostUrl: 'ghosts/9.bin' },
				{ idRecord: 7, ghostUrl: 'ghosts/7.bin' },
			])
			.mockResolvedValueOnce([])
		const helpers = createHelpers()

		await backfillRecordGhostStatistics({ limit: 2, reparseGhostVersion: 5 }, helpers as never)

		expect(getRecordMediaForStatisticBackfill).toHaveBeenNthCalledWith(1, {
			beforeId: undefined,
			limit: 2,
			reparseGhostVersion: 5,
		})
		expect(getRecordMediaForStatisticBackfill).toHaveBeenNthCalledWith(2, {
			beforeId: 7,
			limit: 2,
			reparseGhostVersion: 5,
		})
		expect(helpers.addJob).toHaveBeenCalledWith(
			'backfillRecordGhostStatisticsBatch',
			{ ids: [9, 7] },
			{ jobKey: 'backfill-record-ghost-statistics:v5:9-7' },
		)
		expect(helpers.logger.info).toHaveBeenCalledWith(
			'Enqueued record ghost statistics backfill batches.',
			{
				enqueued: 2,
				batchSize: 2,
				reparseGhostVersion: 5,
			},
		)
	})

	test('batch reparses and upserts complete statistics metadata', async () => {
		getRecordMediaForStatisticBackfill.mockResolvedValue([
			{ idRecord: 9, ghostUrl: 'ghosts/record.bin' },
		])
		const helpers = createHelpers()

		await backfillRecordGhostStatisticsBatch({ ids: [9] }, helpers as never)

		expect(parseGhostStatistics).toHaveBeenCalledTimes(1)
		expect(upsertRecordStatistic).toHaveBeenCalledWith({
			idRecord: 9,
			ghostVersion: 6,
			hasInputData: true,
			hasAirData: true,
			hasWheelData: true,
			hasSlipData: true,
			hasStateData: true,
			hasSurfaceData: true,
			hasVelocityData: true,
			hasRagdollData: true,
			timeAnyDriverInput: 1,
			driverInputTransitionCount: 2,
		})
	})

	test('batch leaves failed parses eligible for a later retry', async () => {
		getRecordMediaForStatisticBackfill.mockResolvedValue([
			{ idRecord: 9, ghostUrl: 'ghosts/record.bin' },
		])
		parseGhostStatistics.mockRejectedValue(new Error('invalid ghost'))
		const helpers = createHelpers()

		await backfillRecordGhostStatisticsBatch({ ids: [9] }, helpers as never)

		expect(upsertRecordStatistic).not.toHaveBeenCalled()
		expect(helpers.logger.warn).toHaveBeenCalled()
	})

	test('batch leaves failed downloads eligible for a later retry', async () => {
		getRecordMediaForStatisticBackfill.mockResolvedValue([
			{ idRecord: 9, ghostUrl: 'ghosts/record.bin' },
		])
		globalThis.fetch = mock(async () => new Response(null, { status: 503 })) as never
		const helpers = createHelpers()

		await backfillRecordGhostStatisticsBatch({ ids: [9] }, helpers as never)

		expect(parseGhostStatistics).not.toHaveBeenCalled()
		expect(upsertRecordStatistic).not.toHaveBeenCalled()
		expect(helpers.logger.warn).toHaveBeenCalledWith(
			'Failed to backfill ghost statistics for record 9.',
			expect.objectContaining({ error: expect.any(Error) }),
		)
	})
})
