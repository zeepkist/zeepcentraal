import type { JobHelpers } from 'graphile-worker'
import { wrapTask } from '../jobTelemetry'
import type { TaskIdentifier } from '../taskDefinitions'
import {
	backfillRecordGhostStatistics,
	backfillRecordGhostStatisticsBatch,
} from './backfillRecordGhostStatistics'
import { prepareTrackTournamentLobbyAsset } from './prepareTrackTournamentLobbyAsset'
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

type GWTask = (payload: unknown, helpers: JobHelpers) => Promise<void>

// graphile-worker task list — keys must match the task name strings used in addJob()
export const taskList = {
	backfillRecordGhostStatistics: wrapTask(
		'backfillRecordGhostStatistics',
		backfillRecordGhostStatistics as GWTask,
	),
	backfillRecordGhostStatisticsBatch: wrapTask(
		'backfillRecordGhostStatisticsBatch',
		backfillRecordGhostStatisticsBatch as GWTask,
	),
	recoverLevelRequests: wrapTask('recoverLevelRequests', recoverLevelRequests as GWTask),
	prepareTrackTournamentLobbyAsset: wrapTask(
		'prepareTrackTournamentLobbyAsset',
		prepareTrackTournamentLobbyAsset as GWTask,
	),
	scanWorkshopBatch: wrapTask('scanWorkshopBatch', scanWorkshopBatch as GWTask),
	scanWorkshopItem: wrapTask('scanWorkshopItem', scanWorkshopItem as GWTask),
	rotateTrackTournament: wrapTask('rotateTrackTournament', rotateTrackTournament as GWTask),
	syncPersonalBests: wrapTask('syncPersonalBests', syncPersonalBests as GWTask),
	syncWorkshopCatalog: wrapTask('syncWorkshopCatalog', syncWorkshopCatalog as GWTask),
	updateLevelPointsHistory: wrapTask(
		'updateLevelPointsHistory',
		updateLevelPointsHistory as GWTask,
	),
	updateLevelPointsHistoryBatch: wrapTask(
		'updateLevelPointsHistoryBatch',
		updateLevelPointsHistoryBatch as GWTask,
	),
	updateLevelScore: wrapTask('updateLevelScore', updateLevelScore as GWTask),
	updateLevelScores: wrapTask('updateLevelScores', updateLevelScores as GWTask),
	updatePlayerScore: wrapTask('updatePlayerScore', updatePlayerScore as GWTask),
	updatePlayerScores: wrapTask('updatePlayerScores', updatePlayerScores as GWTask),
	updateUserPointsHistory: wrapTask('updateUserPointsHistory', updateUserPointsHistory as GWTask),
	updateUserPointsHistoryBatch: wrapTask(
		'updateUserPointsHistoryBatch',
		updateUserPointsHistoryBatch as GWTask,
	),
} satisfies Record<TaskIdentifier, GWTask>
