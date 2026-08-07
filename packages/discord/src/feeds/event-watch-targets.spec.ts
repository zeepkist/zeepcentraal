import { expect, test } from 'bun:test'
import { createFeedEvent } from '../../test/feed-mocks'
import { eventWatchTargets } from './event-watch-targets'

test('event watch targets include rank players, levels, and authors', () => {
	const targets = eventWatchTargets(
		createFeedEvent({
			kind: 'rank_batch',
			payload: { changes: [{ idUser: 11 }, { idUser: '12' }, { idUser: null }] },
		}),
	)
	expect(targets[0]?.targetIds).toContain('11')
	expect(targets[1]?.targetIds).toEqual(['3', 'level-hash', 'Fast Track'])
	expect(targets[2]?.targetIds).toContain('Player Seven')
	expect(
		eventWatchTargets(createFeedEvent({ level: null, payload: null }))[1]?.targetIds,
	).toEqual([])
})
