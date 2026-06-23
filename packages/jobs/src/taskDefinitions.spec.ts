import { expect, test } from 'bun:test'
import { cronTasks } from './cronTasks'
import { isValidTaskPayload } from './taskDefinitions'

test('task payload validation accepts compatible legacy shapes', () => {
	expect(isValidTaskPayload('updateLevelScore', { idLevel: 1, idUser: 2 })).toBe(true)
	expect(isValidTaskPayload('updateLevelPointsHistoryBatch', { offset: 0, limit: 200 })).toBe(
		true,
	)
	expect(isValidTaskPayload('updateLevelPointsHistoryBatch', { ids: [1, 2] })).toBe(true)
	expect(
		isValidTaskPayload('updateLevelScoresBatch', {
			ids: [1, 2],
			personalBestCountPercentile: 42.5,
		}),
	).toBe(true)
	expect(isValidTaskPayload('scanWorkshopItem', { workshopId: '3749321871' })).toBe(true)
	expect(
		isValidTaskPayload('scanWorkshopBatch', {
			workshopIds: ['3006532933', '3749321871'],
		}),
	).toBe(true)
})

test('task payload validation rejects missing required identifiers', () => {
	expect(isValidTaskPayload('updateLevelScore', {})).toBe(false)
	expect(isValidTaskPayload('updatePlayerScore', { idUser: 0 })).toBe(false)
	expect(isValidTaskPayload('scanWorkshopItem', { workshopId: 3749321871 })).toBe(false)
	expect(isValidTaskPayload('scanWorkshopItem', { workshopId: '0' })).toBe(false)
	expect(
		isValidTaskPayload('updateLevelScoresBatch', {
			ids: Array.from({ length: 51 }, (_, index) => index + 1),
			personalBestCountPercentile: 1,
		}),
	).toBe(false)
	expect(
		isValidTaskPayload('scanWorkshopBatch', {
			workshopIds: Array.from({ length: 11 }, (_, index) => `${index + 1}`),
		}),
	).toBe(false)
})

test('workshop catalog sync runs Sunday at 01:00 Europe/London', () => {
	expect(cronTasks).toContainEqual({
		task: 'syncWorkshopCatalog',
		cronTime: '0 1 * * 0',
	})
})
