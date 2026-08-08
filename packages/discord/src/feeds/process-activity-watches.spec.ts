import { expect, mock, test } from 'bun:test'
import { createFeedClient, createFeedEvent } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { processActivityWatches } from './process-activity-watches'

test('activity watch processor delivers matching events and always advances cursor', async () => {
	const event = createFeedEvent()
	const { client, send } = createFeedClient()
	const { backend, context } = createMockContext({
		backend: {
			workerCursor: mock(async () => ({ cursorEventId: '0' })),
			matchingWatches: mock(async () => [
				{ id: 'watch', discordId: 'discord-1', lastDeliveryKey: null },
			]),
		},
	})
	await processActivityWatches(client, [event], context)
	expect(send).toHaveBeenCalledTimes(1)
	expect(backend.advanceWorkerCursor).toHaveBeenCalledWith('watch-events', '1')
	await processActivityWatches(
		client,
		[createFeedEvent({ kind: 'rank_batch', payload: null })],
		context,
	)
	expect(send).toHaveBeenCalledTimes(1)
	backend.matchingWatches.mockImplementation(async () => [])
	await processActivityWatches(client, [event], context)
	expect(send).toHaveBeenCalledTimes(1)
})

test('activity watch processor delivers personal-best batches oldest first', async () => {
	const { client, send } = createFeedClient()
	const { backend, context } = createMockContext({
		backend: {
			workerCursor: mock(async () => ({ cursorEventId: '0' })),
			matchingWatches: mock(async () => [
				{ id: 'watch', discordId: 'discord-1', lastDeliveryKey: null },
			]),
		},
	})
	await processActivityWatches(
		client,
		[
			createFeedEvent({
				id: '1',
				kind: 'personal_best',
				occurredAt: '2026-08-06T12:00:00Z',
			}),
			createFeedEvent({
				id: '2',
				kind: 'personal_best',
				occurredAt: '2026-08-06T12:01:00Z',
			}),
		],
		context,
	)
	expect(send).toHaveBeenCalledTimes(2)
	expect(backend.advanceWorkerCursor.mock.calls.map((call) => call[1])).toEqual(['1', '2'])
})

test('activity watch processor ignores websocket replay at durable cursor', async () => {
	const { client, send } = createFeedClient()
	const { backend, context } = createMockContext({
		backend: { workerCursor: mock(async () => ({ cursorEventId: '1' })) },
	})
	await processActivityWatches(client, [createFeedEvent({ id: '1' })], context)
	expect(send).not.toHaveBeenCalled()
	expect(backend.matchingWatches).not.toHaveBeenCalled()
	expect(backend.advanceWorkerCursor).not.toHaveBeenCalled()
})
