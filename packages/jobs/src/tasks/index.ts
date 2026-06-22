import type { Helpers } from 'graphile-worker'
import type { TaskIdentifier } from '../taskDefinitions'
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

type GWTask = (payload: unknown, helpers: Helpers) => Promise<void>

// graphile-worker task list — keys must match the task name strings used in addJob()
export const taskList = {
	scanWorkshopItem: scanWorkshopItem as GWTask,
	syncPersonalBests: syncPersonalBests as GWTask,
	syncWorkshopCatalog: syncWorkshopCatalog as GWTask,
	updateLevelPointsHistory: updateLevelPointsHistory as GWTask,
	updateLevelPointsHistoryBatch: updateLevelPointsHistoryBatch as GWTask,
	updateLevelScore: updateLevelScore as GWTask,
	updateLevelScores: updateLevelScores as GWTask,
	updatePlayerScore: updatePlayerScore as GWTask,
	updatePlayerScores: updatePlayerScores as GWTask,
	updateUserPointsHistory: updateUserPointsHistory as GWTask,
	updateUserPointsHistoryBatch: updateUserPointsHistoryBatch as GWTask,
} satisfies Record<TaskIdentifier, GWTask>
