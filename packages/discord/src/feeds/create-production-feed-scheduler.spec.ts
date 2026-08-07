import { expect, test } from 'bun:test'
import { createProductionFeedScheduler } from './create-production-feed-scheduler'

test('production feed scheduler exposes timer functions', () => {
	const scheduler = createProductionFeedScheduler()
	expect(typeof scheduler.setInterval).toBe('function')
	expect(typeof scheduler.clearInterval).toBe('function')
})
