import { expect, test } from 'bun:test'
import { cronTasks } from './cronTasks'
import { WORKSHOP_JOB_PRIORITY } from './priorities'
import {
	compatibleTaskIdentifiers,
	isCompatibleTaskIdentifier,
	isValidTaskPayload,
} from './taskDefinitions'
import {
	PLAYER_SCORE_QUEUE_NAME,
	UPDATE_PLAYER_SCORES_JOB_KEY,
} from './utils/playerScoreJobOptions'

const expectedCompatibleTaskIdentifiers = [
	'backfillRecordGhostStatistics',
	'backfillRecordGhostStatisticsBatch',
	'scanWorkshopBatch',
	'scanWorkshopItem',
	'syncPersonalBests',
	'syncWorkshopCatalog',
	'updateLevelPointsHistory',
	'updateLevelPointsHistoryBatch',
	'updateLevelScore',
	'updateLevelScores',
	'updatePlayerScore',
	'updatePlayerScores',
	'updateUserPointsHistory',
	'updateUserPointsHistoryBatch',
] as const

test('compatible task contract exposes exact API-triggerable task list', () => {
	expect(compatibleTaskIdentifiers).toEqual(expectedCompatibleTaskIdentifiers)
	expect(compatibleTaskIdentifiers).not.toContain('updateLevelScoresBatch')
	expect(isCompatibleTaskIdentifier('updateLevelScoresBatch')).toBe(false)
	expect(isCompatibleTaskIdentifier('updateLevelScore')).toBe(true)
})

test('task payload validation accepts compatible legacy shapes', () => {
	expect(isValidTaskPayload('updateLevelScore', { idLevel: 1, idUser: 2 })).toBe(true)
	expect(isValidTaskPayload('updateLevelScore', { idLevel: 1, reportOnly: true })).toBe(true)
	expect(isValidTaskPayload('updateLevelScores', { all: true, reportOnly: true })).toBe(true)
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
	expect(isValidTaskPayload('syncWorkshopCatalog', { all: true })).toBe(true)
	expect(isValidTaskPayload('syncWorkshopCatalog', { repairZslAuthors: true })).toBe(true)
	expect(
		isValidTaskPayload('syncWorkshopCatalog', {
			all: true,
			fixZeepSDKExponentHashes: true,
		}),
	).toBe(true)
	expect(
		isValidTaskPayload('scanWorkshopBatch', {
			workshopIds: ['3006532933', '3749321871'],
		}),
	).toBe(true)
	expect(
		isValidTaskPayload('backfillRecordGhostStatistics', {
			reparseGhostVersion: 5,
			limit: 500,
		}),
	).toBe(true)
})

test('task payload validation rejects missing required identifiers', () => {
	expect(isValidTaskPayload('updateLevelScore', {})).toBe(false)
	expect(isValidTaskPayload('updatePlayerScore', { idUser: 0 })).toBe(false)
	expect(isValidTaskPayload('scanWorkshopItem', { workshopId: 3749321871 })).toBe(false)
	expect(isValidTaskPayload('scanWorkshopItem', { workshopId: '0' })).toBe(false)
	expect(isValidTaskPayload('syncWorkshopCatalog', { all: 'true' })).toBe(false)
	expect(isValidTaskPayload('syncWorkshopCatalog', { repairZslAuthors: false })).toBe(false)
	expect(isValidTaskPayload('syncWorkshopCatalog', { all: true, repairZslAuthors: true })).toBe(
		false,
	)
	expect(
		isValidTaskPayload('syncWorkshopCatalog', {
			fixZeepSDKExponentHashes: true,
			repairZslAuthors: true,
		}),
	).toBe(false)
	expect(isValidTaskPayload('syncWorkshopCatalog', { fixZeepSDKExponentHashes: 'true' })).toBe(
		false,
	)
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
	expect(
		isValidTaskPayload('backfillRecordGhostStatistics', {
			reparseGhostVersion: 6,
		}),
	).toBe(false)
	expect(
		isValidTaskPayload('backfillRecordGhostStatistics', {
			ids: [1],
			reparseGhostVersion: 5,
		}),
	).toBe(false)
})

test('workshop catalog sync runs Sunday at 01:00 Europe/London', () => {
	expect(cronTasks).toContainEqual({
		task: 'syncWorkshopCatalog',
		cronTime: '0 1 * * 0',
		spec: { priority: WORKSHOP_JOB_PRIORITY },
	})
})

test('track tournaments rotate at exact UTC boundaries with distinct keys', () => {
	expect(cronTasks).toContainEqual({
		task: 'rotateTrackTournament',
		cronTime: '0 6 * * 1',
		payload: { type: 0 },
		timeZone: 'UTC',
		spec: { jobKey: 'cron:rotateTrackTournament:weekly' },
	})
	expect(cronTasks).toContainEqual({
		task: 'rotateTrackTournament',
		cronTime: '0 6 1 * *',
		payload: { type: 1 },
		timeZone: 'UTC',
		spec: { jobKey: 'cron:rotateTrackTournament:monthly' },
	})
	expect(isValidTaskPayload('rotateTrackTournament', { type: 0 })).toBe(true)
	expect(isValidTaskPayload('rotateTrackTournament', { type: 2 })).toBe(false)
	expect(isCompatibleTaskIdentifier('rotateTrackTournament')).toBe(false)
})

test('full player scoring uses serialized contribution queue', () => {
	expect(cronTasks).toContainEqual({
		task: 'updatePlayerScores',
		cronTime: '5-59/10 * * * *',
		spec: {
			jobKey: UPDATE_PLAYER_SCORES_JOB_KEY,
			jobKeyMode: 'unsafe_dedupe',
			queueName: PLAYER_SCORE_QUEUE_NAME,
		},
	})
})
