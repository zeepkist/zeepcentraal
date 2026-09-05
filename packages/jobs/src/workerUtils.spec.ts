import { expect, test } from 'bun:test'
import { lockGroup, queueClient } from './pgmq'

test('native queue pool retains configured connection cap', () => {
	const client = queueClient()
	expect(client.options.max).toBe(2)
})
test('bulk global maintenance excludes peers without blocking fast jobs', () => {
	expect(lockGroup('updatePlayerScores', 'bulk', {})).toBe('global-scores')
	expect(lockGroup('updateLevelScores', 'bulk', {})).toBe('global-scores')
	expect(lockGroup('updatePlayerScore', 'fast', { queueName: 'player-score-writes' })).toBeNull()
})
