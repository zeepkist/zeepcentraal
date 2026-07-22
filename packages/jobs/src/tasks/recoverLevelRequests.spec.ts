import { expect, mock, test } from 'bun:test'

const getPendingLevelRequests = mock(async ({ afterId }: { afterId?: number }) =>
	afterId === 0
		? [
				{ id: 10, workshopId: 100n },
				{ id: 11, workshopId: 200n },
			]
		: [],
)

mock.module('@zeepkist/database/services/workshop', () => ({ getPendingLevelRequests }))

const { recoverLevelRequests } = await import('./recoverLevelRequests')

test('pages durable requests and enqueues idempotent workshop scans', async () => {
	const addJobs = mock(async () => [])
	const info = mock(() => {})

	await recoverLevelRequests({}, { addJobs, logger: { info } } as never)

	expect(getPendingLevelRequests).toHaveBeenCalledWith({ afterId: 0, limit: 1_000 })
	expect(addJobs).toHaveBeenCalledWith([
		{
			identifier: 'scanWorkshopItem',
			payload: { workshopId: '100' },
			priority: 100,
			maxAttempts: 5,
			jobKey: 'scan-workshop-item:100',
		},
		{
			identifier: 'scanWorkshopItem',
			payload: { workshopId: '200' },
			priority: 100,
			maxAttempts: 5,
			jobKey: 'scan-workshop-item:200',
		},
	])
	expect(info).toHaveBeenCalledWith('recoverLevelRequests queued 2 pending workshop scans.')
})
