import { wrapTask } from '../jobTelemetry'
import type { JobHelpers } from '../queueTypes'
import type { TaskIdentifier } from '../taskDefinitions'
import {
	backfillRecordGhostStatistics,
	backfillRecordGhostStatisticsBatch,
} from './backfillRecordGhostStatistics'
import { prepareTrackTournamentLobbyAsset } from './prepareTrackTournamentLobbyAsset'
import { prunePointsHistory } from './prunePointsHistory'
import { recoverLevelRequests } from './recoverLevelRequests'
import { rotateTrackTournament } from './rotateTrackTournament'
import { scanWorkshopBatch } from './scanWorkshopBatch'
import { scanWorkshopItem } from './scanWorkshopItem'
import { syncPersonalBests } from './syncPersonalBests'
import { syncWorkshopCatalog } from './syncWorkshopCatalog'
import { updateLevelPointsHistory } from './updateLevelPointsHistory'
import { updateLevelPointsHistoryBatch } from './updateLevelPointsHistoryBatch'
import { updateLevelScore } from './updateLevelScore'
import { updateLevelScores } from './updateLevelScores'
import { updatePlayerScore } from './updatePlayerScore'
import { updatePlayerScores } from './updatePlayerScores'
import { updateUserPointsHistory } from './updateUserPointsHistory'
import { updateUserPointsHistoryBatch } from './updateUserPointsHistoryBatch'

type RegisteredTask = (payload: unknown, helpers: JobHelpers) => Promise<void>

// Application task list — keys must match the task name strings used in addJob()
export const taskList = {
	backfillRecordGhostStatistics: wrapTask(
		'backfillRecordGhostStatistics',
		backfillRecordGhostStatistics as RegisteredTask,
	),
	backfillRecordGhostStatisticsBatch: wrapTask(
		'backfillRecordGhostStatisticsBatch',
		backfillRecordGhostStatisticsBatch as RegisteredTask,
	),
	prunePointsHistory: wrapTask('prunePointsHistory', prunePointsHistory as RegisteredTask),
	recoverLevelRequests: wrapTask('recoverLevelRequests', recoverLevelRequests as RegisteredTask),
	prepareTrackTournamentLobbyAsset: wrapTask(
		'prepareTrackTournamentLobbyAsset',
		prepareTrackTournamentLobbyAsset as RegisteredTask,
	),
	scanWorkshopBatch: wrapTask('scanWorkshopBatch', scanWorkshopBatch as RegisteredTask),
	scanWorkshopItem: wrapTask('scanWorkshopItem', scanWorkshopItem as RegisteredTask),
	rotateTrackTournament: wrapTask(
		'rotateTrackTournament',
		rotateTrackTournament as RegisteredTask,
	),
	syncPersonalBests: wrapTask('syncPersonalBests', syncPersonalBests as RegisteredTask),
	syncWorkshopCatalog: wrapTask('syncWorkshopCatalog', syncWorkshopCatalog as RegisteredTask),
	updateLevelPointsHistory: wrapTask(
		'updateLevelPointsHistory',
		updateLevelPointsHistory as RegisteredTask,
	),
	updateLevelPointsHistoryBatch: wrapTask(
		'updateLevelPointsHistoryBatch',
		updateLevelPointsHistoryBatch as RegisteredTask,
	),
	updateLevelScore: wrapTask('updateLevelScore', updateLevelScore as RegisteredTask),
	updateLevelScores: wrapTask('updateLevelScores', updateLevelScores as RegisteredTask),
	updatePlayerScore: wrapTask('updatePlayerScore', updatePlayerScore as RegisteredTask),
	updatePlayerScores: wrapTask('updatePlayerScores', updatePlayerScores as RegisteredTask),
	updateUserPointsHistory: wrapTask(
		'updateUserPointsHistory',
		updateUserPointsHistory as RegisteredTask,
	),
	updateUserPointsHistoryBatch: wrapTask(
		'updateUserPointsHistoryBatch',
		updateUserPointsHistoryBatch as RegisteredTask,
	),
} satisfies Record<TaskIdentifier, RegisteredTask>
