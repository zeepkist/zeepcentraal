import { expect, test } from 'bun:test'
import { cronJobOptions } from './cronJobOptions'

const defaults = { maxAttempts: 3 }

test('uses normal coalescing replacement for serialized score tasks', () => {
	expect(
		cronJobOptions('updatePlayerScores', defaults, {
			jobKey: 'update-player-scores',
			queueName: 'player-score-writes',
		}),
	).toEqual({
		maxAttempts: 3,

		jobKey: 'update-player-scores',

		queueName: 'player-score-writes',
	})
})

test('uses stable coalescing defaults for ordinary cron tasks', () => {
	expect(cronJobOptions('updateLevelScores', defaults)).toEqual({
		maxAttempts: 3,

		jobKey: 'cron:updateLevelScores',
	})
})
