import { expect, mock, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createFeedClient } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { displayContainer, messagePayload } from '../display'
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
		messagePayload(displayContainer({ description: 'Hello', title: 'Watch update' })),
		context,
	)
	expect(fetch).toHaveBeenCalledTimes(1)
	const sent = (send.mock.calls as unknown[][])[0]?.[0]
	expectComponentsV2(sent)
	expect(sent).toMatchObject({ allowedMentions: { parse: [] } })
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
