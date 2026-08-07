import { expect, mock, test } from 'bun:test'
import { createFeedClient, createFeedEvent } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { processActivityWatches } from './process-activity-watches'

test('activity watch processor delivers matching events and always advances cursor', async () => {
	const event = createFeedEvent()
	const { client, send } = createFeedClient()
	const { backend, context, graphql } = createMockContext({
		backend: {
			workerCursor: mock(async () => ({ cursorEventId: '4' })),
			matchingWatches: mock(async () => [
				{ id: 'watch', discordId: 'discord-1', lastDeliveryKey: null },
			]),
		},
		graphql: { activityEvents: mock(async () => [event]) },
	})
	await processActivityWatches(client, context)
	expect(send).toHaveBeenCalledTimes(1)
	expect(backend.advanceWorkerCursor).toHaveBeenCalledWith('watch-events', 'event-1')
	graphql.activityEvents.mockImplementation(async () => [
		createFeedEvent({ kind: 'rank_batch', payload: null }),
	])
	await processActivityWatches(client, context)
	expect(send).toHaveBeenCalledTimes(1)
	backend.matchingWatches.mockImplementation(async () => [])
	await processActivityWatches(client, context)
	expect(send).toHaveBeenCalledTimes(1)
})
