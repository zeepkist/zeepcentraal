import { expect, test } from 'bun:test'
import { createFeedEvent } from '../../test/feed-mocks'
import { eventLevelName } from './event-level-name'

test('event level name uses level, payload, and unknown fallbacks', () => {
	expect(eventLevelName(createFeedEvent())).toBe('Fast Track')
	expect(
		eventLevelName(createFeedEvent({ level: null, payload: { name: 'Payload track' } })),
	).toBe('Payload track')
	expect(eventLevelName(createFeedEvent({ level: null, payload: null }))).toBe('Unknown level')
})
