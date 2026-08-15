import { expect, test } from 'bun:test'
import { levelScoreJobOptions } from './levelScoreJobOptions'
import { PLAYER_SCORE_QUEUE_NAME } from './playerScoreJobOptions'

test('deduplicates persistent level scoring by level', () => {
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 1 })).toEqual({
		jobKey: 'update-level-score:42',
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 2 })).toEqual({
		jobKey: 'update-level-score:42',
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 43 })).toEqual({
		jobKey: 'update-level-score:43',
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
})

test('keeps report-only score jobs separate from persistent scoring', () => {
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, reportOnly: true })).toEqual({
		jobKey: 'update-level-score-report:42',
	})
	expect(levelScoreJobOptions('updatePlayerScore', { idLevel: 42 })).toEqual({})
})

test('serializes full and incremental bulk scoring under distinct keys', () => {
	expect(levelScoreJobOptions('updateLevelScores', { all: true })).toEqual({
		jobKey: 'update-level-scores:full',
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	expect(levelScoreJobOptions('updateLevelScores', { all: false })).toEqual({
		jobKey: 'update-level-scores:incremental',
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	expect(levelScoreJobOptions('updateLevelScores', { all: true, reportOnly: true })).toEqual({
		jobKey: 'update-level-scores-report:full',
	})
})
