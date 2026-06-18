import { expect, test } from 'bun:test'
import { isValidTaskPayload } from './taskDefinitions'

test('task payload validation accepts compatible legacy shapes', () => {
	expect(isValidTaskPayload('updateLevelScore', { idLevel: 1, idUser: 2 })).toBe(true)
	expect(isValidTaskPayload('updateLevelPointsHistoryBatch', { offset: 0, limit: 200 })).toBe(
		true,
	)
	expect(isValidTaskPayload('updateLevelPointsHistoryBatch', { ids: [1, 2] })).toBe(true)
})

test('task payload validation rejects missing required identifiers', () => {
	expect(isValidTaskPayload('updateLevelScore', {})).toBe(false)
	expect(isValidTaskPayload('updatePlayerScore', { idUser: 0 })).toBe(false)
})
