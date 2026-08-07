import { expect, mock, test } from 'bun:test'
import { createFeedClient } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { deliverWatches } from './deliver-watches'

test('watch delivery groups recipients, skips delivered watches, and records success', async () => {
	const { backend, context } = createMockContext()
	const { client, fetch, send } = createFeedClient()
	await deliverWatches(
		client,
		[
			{ id: 'a', discordId: 'discord-1', lastDeliveryKey: null },
			{ id: 'b', discordId: 'discord-1', lastDeliveryKey: null },
			{ id: 'c', discordId: 'discord-2', lastDeliveryKey: 'delivery' },
		] as never,
		'delivery',
		{ content: 'hello' },
		context,
	)
	expect(fetch).toHaveBeenCalledTimes(1)
	expect(send).toHaveBeenCalledWith(
		expect.objectContaining({ content: undefined, allowedMentions: { parse: [] } }),
	)
	expect(backend.updateWatchDelivery).toHaveBeenCalledTimes(2)
	expect(backend.updateWatchDelivery.mock.calls[0]).toEqual([
		'a',
		{ paused: false, lastError: null, deliveryKey: 'delivery' },
	])
})

test('watch delivery pauses permanent failures and rethrows transient failures', async () => {
	const permanent = createMockContext()
	const permanentClient = createFeedClient(
		[],
		mock(async () => Promise.reject(Object.assign(new Error('closed'), { code: 50007 }))),
	)
	await deliverWatches(
		permanentClient.client,
		[{ id: 'a', discordId: 'discord-1', lastDeliveryKey: null }] as never,
		'delivery',
		{},
		permanent.context,
	)
	expect(permanent.backend.updateWatchDelivery).toHaveBeenCalledWith('a', {
		paused: true,
		lastError: 'closed',
		deliveryKey: null,
	})

	const transient = createMockContext()
	const transientClient = createFeedClient(
		[],
		mock(async () => Promise.reject('temporary')),
	)
	await expect(
		deliverWatches(
			transientClient.client,
			[{ id: 'b', discordId: 'discord-2', lastDeliveryKey: null }] as never,
			'delivery',
			{},
			transient.context,
		),
	).rejects.toBe('temporary')
	expect(transient.backend.updateWatchDelivery).toHaveBeenCalledWith('b', {
		paused: false,
		lastError: 'temporary',
		deliveryKey: null,
	})
})
