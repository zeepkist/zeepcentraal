import { expect, mock, test } from 'bun:test'
import { displayText, expectComponentsV2 } from '../../test/components'
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
	expectComponentsV2(workshop)
	expect(displayText(workshop)).toContain('New public workshop level')
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
	).toContain('**Vote**  1')
	const worldRecord = await eventMessage(createFeedEvent(), context)
	if (!worldRecord) throw new Error('world-record message missing')
	expectComponentsV2(worldRecord)
	expect(displayText(worldRecord)).toContain('<@discord-2>')
	expect(worldRecord.allowedMentions).toEqual({ users: ['discord-2'], parse: [] })
	expect(displayText(worldRecord)).toContain('Stolen from Previous')
	expect(JSON.stringify(worldRecord)).toContain('https://image.test/level.jpg')
	expect(displayText(worldRecord)).toContain('**Record**  Player Seven (<@discord-1>) • 12.300s')
	expect(displayText(worldRecord)).toContain(
		'**Level activity**  1,235 points • 25 personal bests',
	)

	const firstRecord = await eventMessage(
		createFeedEvent({
			previousUserId: null,
			previousRecordId: null,
			previousUser: null,
			previousRecord: null,
		}),
		context,
	)
	expect(displayText(firstRecord)).not.toContain('<@discord-2> your world record')
	expect(displayText(firstRecord)).toContain('First record set on this level.')

	const samePlayerLookup = mock(async () => ({
		linkedUser,
		preference: { pingOnWorldRecordLoss: true },
		watches: [],
	}))
	const samePlayerContext = createMockContext({ backend: { user: samePlayerLookup } }).context
	const improved = await eventMessage(
		createFeedEvent({
			previousUserId: linkedUser.id,
			previousUser: linkedUser,
		}),
		samePlayerContext,
	)
	expect(displayText(improved)).toContain('Improved by 0.100s')
	expect(displayText(improved)).not.toContain('Stolen from')
	expect(samePlayerLookup).not.toHaveBeenCalled()

	const failedPreference = createMockContext({
		backend: { user: mock(async () => Promise.reject(new Error('backend offline'))) },
	}).context
	expect(displayText(await eventMessage(createFeedEvent(), failedPreference))).not.toContain(
		'<@discord-2> your world record',
	)
	const watchLookup = mock(async () => {
		throw new Error('watch messages must not load ping preferences')
	})
	const watchContext = createMockContext({ backend: { user: watchLookup } }).context
	const watchMessage = await eventMessage(createFeedEvent(), watchContext, {
		includeLossPing: false,
	})
	expect(displayText(watchMessage)).not.toContain('<@discord-2> your world record')
	expect(watchLookup).not.toHaveBeenCalled()
	await expect(
		eventMessage(createFeedEvent({ kind: 'unsupported' as never }), context),
	).rejects.toThrow('Unsupported Discord activity event kind: unsupported')
})
