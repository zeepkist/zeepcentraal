import { expect, test } from 'bun:test'
import { cronJobOptions } from './cronJobOptions'

const defaults = { maxAttempts: 3, priority: 0 }

test('preserves task-specific job key mode', () => {
	expect(
		cronJobOptions('updatePlayerScores', defaults, {
			jobKey: 'update-player-scores',
			jobKeyMode: 'unsafe_dedupe',
			queueName: 'player-score-writes',
		}),
	).toEqual({
		maxAttempts: 3,
		priority: 0,
		jobKey: 'update-player-scores',
		jobKeyMode: 'unsafe_dedupe',
		queueName: 'player-score-writes',
	})
})

test('uses stable preserve-run-at defaults for ordinary cron tasks', () => {
	expect(cronJobOptions('updateLevelScores', defaults)).toEqual({
		maxAttempts: 3,
		priority: 0,
		jobKey: 'cron:updateLevelScores',
		jobKeyMode: 'preserve_run_at',
	})
})
