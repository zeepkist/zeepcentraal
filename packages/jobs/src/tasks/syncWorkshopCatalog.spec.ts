import { beforeEach, describe, expect, mock, test } from 'bun:test'

const getWorkshopSyncState = mock(async () => new Map())
const listItems = mock(async () => ({
	items: [
		{
			workshopId: 100n,
			updatedAt: '2024-01-01T00:00:00.000Z',
		},
	],
}))

mock.module('@zeepkist/database/services/workshop', () => ({
	getWorkshopSyncState,
}))

mock.module('../workshopScanner', () => ({
	getWorkshopMetadata: () => ({
		listItems,
	}),
	getWorkshopScanner: () => {
		throw new Error('getWorkshopScanner should not be called by syncWorkshopCatalog')
	},
}))

const { syncWorkshopCatalog } = await import('./syncWorkshopCatalog')

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

describe('syncWorkshopCatalog', () => {
	beforeEach(() => {
		getWorkshopSyncState.mockClear()
		listItems.mockClear()
	})

	test('forwards exponent hash fix flag only with all=true', async () => {
		const helpers = createHelpers()

		await syncWorkshopCatalog({ all: true, fixZeepSDKExponentHashes: true }, helpers as never)

		expect(helpers.addJob).toHaveBeenCalledWith(
			'scanWorkshopBatch',
			{ workshopIds: ['100'], fixZeepSDKExponentHashes: true },
			{
				jobKey: 'scan-workshop-batch:100:100',
				maxAttempts: 5,
				priority: 100,
			},
		)
	})

	test('does not forward exponent hash fix flag without all=true', async () => {
		const helpers = createHelpers()

		await syncWorkshopCatalog({ fixZeepSDKExponentHashes: true }, helpers as never)

		expect(helpers.addJob).toHaveBeenCalledWith(
			'scanWorkshopBatch',
			{ workshopIds: ['100'] },
			{
				jobKey: 'scan-workshop-batch:100:100',
				maxAttempts: 5,
				priority: 100,
			},
		)
	})
})
