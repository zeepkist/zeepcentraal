import { expect, test } from 'bun:test'
import { levelScoreJobOptions } from './levelScoreJobOptions'

test('deduplicates persistent level scoring by level', () => {
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 1 })).toEqual({
		jobKey: 'update-level-score:42',
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, idUser: 2 })).toEqual({
		jobKey: 'update-level-score:42',
	})
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 43 })).toEqual({
		jobKey: 'update-level-score:43',
	})
})

test('keeps report-only score jobs separate from persistent scoring', () => {
	expect(levelScoreJobOptions('updateLevelScore', { idLevel: 42, reportOnly: true })).toEqual({
		jobKey: 'update-level-score-report:42',
	})
	expect(levelScoreJobOptions('updatePlayerScore', { idLevel: 42 })).toEqual({})
})
