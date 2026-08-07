import { expect, mock, test } from 'bun:test'
import type { APIEmbed, MessageCreateOptions } from 'discord.js'
import { createFeedEvent } from '../../test/feed-mocks'
import { createMockContext, linkedUser } from '../../test/mocks'
import { eventMessage } from './event-message'

test('event messages switch covers rank, workshop, personal best, vote, and world-record policy', async () => {
	const { context } = createMockContext({
		backend: {
			user: mock(async () => ({
				linkedUser,
				preference: { pingOnWorldRecordLoss: true },
				watches: [],
			})),
		},
	})
	const workshop = await eventMessage(createFeedEvent({ kind: 'workshop' }), context)
	expect(JSON.stringify(workshop)).toContain('New public workshop level')
	expect(JSON.stringify(workshop)).toContain('https://image.test/level.jpg')
	expect(
		JSON.stringify(
			await eventMessage(
				createFeedEvent({
					kind: 'rank_batch',
					payload: { changes: [{ idUser: 7, previousRank: 2, rank: 1 }] },
				}),
				context,
			),
		),
	).toContain('Rank changes')
	expect(
		await eventMessage(createFeedEvent({ kind: 'rank_batch', payload: null }), context),
	).toBeNull()
	const workshopFallback = await eventMessage(
		createFeedEvent({ kind: 'workshop', level: null, payload: { workshopId: '999' } }),
		context,
	)
	expect(JSON.stringify(workshopFallback)).toContain('999')
	expect(
		JSON.stringify(await eventMessage(createFeedEvent({ kind: 'personal_best' }), context)),
	).toContain('New personal best')
	expect(
		JSON.stringify(
			await eventMessage(createFeedEvent({ kind: 'vote', payload: { value: 1 } }), context),
		),
	).toContain('voted 1')
	const worldRecord = (await eventMessage(createFeedEvent(), context)) as MessageCreateOptions
	expect(worldRecord.content).toContain('<@discord-2>')
	expect(worldRecord.allowedMentions).toEqual({ users: ['discord-2'], parse: [] })
	const worldRecordEmbed = worldRecord.embeds?.[0] as APIEmbed
	expect(worldRecordEmbed.description).toContain('Stolen from Previous')
	expect(worldRecordEmbed.thumbnail).toEqual({ url: 'https://image.test/level.jpg' })
	expect(worldRecordEmbed.fields).toEqual([
		{ name: 'Ranked points', value: '100', inline: true },
		{ name: 'Personal bests', value: '25', inline: true },
	])

	const firstRecord = (await eventMessage(
		createFeedEvent({
			previousUserId: null,
			previousRecordId: null,
			previousUser: null,
			previousRecord: null,
		}),
		context,
	)) as MessageCreateOptions
	expect(firstRecord.content).toBeUndefined()
	expect((firstRecord.embeds?.[0] as APIEmbed | undefined)?.description).toContain(
		'First record set on this level.',
	)

	const samePlayerLookup = mock(async () => ({
		linkedUser,
		preference: { pingOnWorldRecordLoss: true },
		watches: [],
	}))
	const samePlayerContext = createMockContext({ backend: { user: samePlayerLookup } }).context
	const improved = (await eventMessage(
		createFeedEvent({
			previousUserId: linkedUser.id,
			previousUser: linkedUser,
		}),
		samePlayerContext,
	)) as MessageCreateOptions
	expect(improved.content).toBeUndefined()
	expect((improved.embeds?.[0] as APIEmbed | undefined)?.description).toContain(
		'Improved by 0.100s',
	)
	expect((improved.embeds?.[0] as APIEmbed | undefined)?.description).not.toContain('Stolen from')
	expect(samePlayerLookup).not.toHaveBeenCalled()

	const failedPreference = createMockContext({
		backend: { user: mock(async () => Promise.reject(new Error('backend offline'))) },
	}).context
	expect(
		((await eventMessage(createFeedEvent(), failedPreference)) as MessageCreateOptions).content,
	).toBeUndefined()
	await expect(
		eventMessage(createFeedEvent({ kind: 'unsupported' as never }), context),
	).rejects.toThrow('Unsupported Discord activity event kind: unsupported')
})
