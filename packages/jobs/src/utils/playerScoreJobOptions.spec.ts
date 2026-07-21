import { describe, expect, test } from 'bun:test'
import {
	PLAYER_SCORE_QUEUE_NAME,
	playerScoreJobOptions,
	UPDATE_PLAYER_SCORES_JOB_KEY,
} from './playerScoreJobOptions'

describe('playerScoreJobOptions', () => {
	test('serializes full and single-user jobs on one queue', () => {
		expect(playerScoreJobOptions('updatePlayerScores', {})).toEqual({
			jobKey: UPDATE_PLAYER_SCORES_JOB_KEY,
			jobKeyMode: 'unsafe_dedupe',
			queueName: PLAYER_SCORE_QUEUE_NAME,
		})
		expect(playerScoreJobOptions('updatePlayerScore', { idUser: 42 })).toEqual({
			jobKey: 'update-player-score:42',
			queueName: PLAYER_SCORE_QUEUE_NAME,
		})
	})

	test('does not affect unrelated jobs', () => {
		expect(playerScoreJobOptions('updateLevelScores', {})).toEqual({})
	})
})
