import { expect, test } from 'bun:test'
import {
	LEVEL_SCORE_QUEUE_COUNT,
	levelScoreJobOptions,
	levelScoreQueueName,
} from './levelScoreJobOptions'
import { PLAYER_SCORE_QUEUE_NAME } from './playerScoreJobOptions'

test('deduplicates persistent level scoring by level', () => {
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 1 })).toEqual({
		jobKey: 'update-level-score:42',
		queueName: 'level-score-writes:2',
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 2 })).toEqual({
		jobKey: 'update-level-score:42',
		queueName: 'level-score-writes:2',
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 43 })).toEqual({
		jobKey: 'update-level-score:43',
		queueName: 'level-score-writes:3',
	})
})

test('maps levels across four stable score shards', () => {
	expect(LEVEL_SCORE_QUEUE_COUNT).toBe(4)
	expect([4, 5, 6, 7, 8].map(levelScoreQueueName)).toEqual([
		'level-score-writes:0',
		'level-score-writes:1',
		'level-score-writes:2',
		'level-score-writes:3',
		'level-score-writes:0',
	])
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
