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
let userItemPages = new Map<number, { nextPage?: number; workshopIds: bigint[] }>()
const listUserItemIds = mock(async (_uploaderId: bigint, page = 1) => {
	return userItemPages.get(page) ?? { workshopIds: [] }
})

mock.module('@zeepkist/database/services/workshop', () => ({
	getWorkshopSyncState,
}))

mock.module('../workshopScanner', () => ({
	getWorkshopMetadata: () => ({
		listItems,
		listUserItemIds,
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
		listUserItemIds.mockClear()
		userItemPages = new Map()
	})

	test('repair mode lists only ZSL uploader items across user pages', async () => {
		workshopSyncState = new Map([
			[999n, { activeItemCount: 1, updatedAt: '2020-01-01T00:00:00.000Z' }],
		])
		userItemPages = new Map([
			[1, { workshopIds: [200n], nextPage: 2 }],
			[2, { workshopIds: [201n] }],
		])
		const helpers = createHelpers()

		await syncWorkshopCatalog({ repairZslAuthors: true }, helpers as never)

		expect(listItems).not.toHaveBeenCalled()
		expect(getWorkshopSyncState).not.toHaveBeenCalled()
		expect(listUserItemIds).toHaveBeenNthCalledWith(1, 76561198031919228n, 1)
		expect(listUserItemIds).toHaveBeenNthCalledWith(2, 76561198031919228n, 2)
		expect(helpers.addJob).toHaveBeenCalledTimes(1)
		expect(helpers.addJob).toHaveBeenCalledWith(
			'scanWorkshopBatch',
			{ workshopIds: ['200', '201'] },
			{
				jobKey: 'scan-workshop-batch:200:201',
				maxAttempts: 5,
				priority: 100,
			},
		)
	})

	test('ordinary catalog sync does not use uploader-specific listing', async () => {
		const helpers = createHelpers()

		await syncWorkshopCatalog({}, helpers as never)

		expect(listUserItemIds).not.toHaveBeenCalled()
		expect(listItems).toHaveBeenCalledTimes(1)
		expect(getWorkshopSyncState).toHaveBeenCalledTimes(1)
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
