import { beforeEach, describe, expect, mock, test } from 'bun:test'

let workshopSyncState = new Map<bigint, { activeItemCount: number; updatedAt: string }>()
const getWorkshopSyncState = mock(async () => workshopSyncState)
let catalogItems = [
	{
		workshopId: 100n,
		creatorId: 76561198000000000n,
		updatedAt: '2024-01-01T00:00:00.000Z',
	},
]
const listItems = mock(async () => ({ items: catalogItems }))

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
		workshopSyncState = new Map()
		catalogItems = [
			{
				workshopId: 100n,
				creatorId: 76561198000000000n,
				updatedAt: '2024-01-01T00:00:00.000Z',
			},
		]
		getWorkshopSyncState.mockClear()
		listItems.mockClear()
	})

	test('repair mode queues only ZSL uploader items', async () => {
		workshopSyncState = new Map([
			[999n, { activeItemCount: 1, updatedAt: '2020-01-01T00:00:00.000Z' }],
		])
		catalogItems = [
			...catalogItems,
			{
				workshopId: 200n,
				creatorId: 76561198031919228n,
				updatedAt: '2020-01-01T00:00:00.000Z',
			},
		]
		const helpers = createHelpers()

		await syncWorkshopCatalog({ repairZslAuthors: true }, helpers as never)

		expect(helpers.addJob).toHaveBeenCalledTimes(1)
		expect(helpers.addJob).toHaveBeenCalledWith(
			'scanWorkshopBatch',
			{ workshopIds: ['200'] },
			{
				jobKey: 'scan-workshop-batch:200:200',
				maxAttempts: 5,
				priority: 100,
			},
		)
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
