import { beforeEach, describe, expect, mock, test } from 'bun:test'

const releaseLevelRequest = mock(async (_workshopId: bigint) => {})

type ScanResult = {
	results: Array<{
		workshopId: bigint
		status: 'scanned' | 'permanently-unavailable' | 'inaccessible'
		changedLevelIds: number[]
	}>
	transientFailures: Array<{ workshopId: bigint; error: unknown }>
}

let scanResult: ScanResult = {
	results: [{ workshopId: 100n, status: 'scanned', changedLevelIds: [] }],
	transientFailures: [],
}
const scanWorkshopItems = mock(async () => scanResult)

mock.module('@zeepkist/database/services/workshop', () => ({
	releaseLevelRequest,
}))

mock.module('../workshopScanner', () => ({
	getWorkshopMetadata: () => {
		throw new Error('getWorkshopMetadata should not be called by scanWorkshopBatch')
	},
	getWorkshopScanner: () => ({
		scanWorkshopItems,
	}),
}))

const { scanWorkshopBatch } = await import('./scanWorkshopBatch')

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

describe('scanWorkshopBatch', () => {
	beforeEach(() => {
		scanResult = {
			results: [{ workshopId: 100n, status: 'scanned', changedLevelIds: [] }],
			transientFailures: [],
		}
		releaseLevelRequest.mockClear()
		scanWorkshopItems.mockClear()
	})

	test('forwards exponent hash fix option to workshop scanner', async () => {
		await scanWorkshopBatch(
			{ workshopIds: ['100'], fixZeepSDKExponentHashes: true },
			createHelpers() as never,
		)

		expect(scanWorkshopItems).toHaveBeenCalledWith([100n], 10, {
			fixZeepSDKExponentHashes: true,
		})
	})

	test('does not create retry jobs for inaccessible workshop results', async () => {
		scanResult = {
			results: [{ workshopId: 100n, status: 'inaccessible', changedLevelIds: [7] }],
			transientFailures: [],
		}
		const helpers = createHelpers()

		await scanWorkshopBatch({ workshopIds: ['100'] }, helpers as never)

		expect(releaseLevelRequest).toHaveBeenCalledWith(100n)
		expect(helpers.addJobs).toHaveBeenCalledWith([
			{
				identifier: 'updateLevelScore',
				payload: { idLevel: 7 },
				jobKey: 'update-level-score:7',
				queueName: 'player-score-writes',
			},
		])
		expect(helpers.logger.warn).not.toHaveBeenCalled()
	})
})
