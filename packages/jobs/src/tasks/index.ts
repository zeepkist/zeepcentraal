import type { Helpers } from 'graphile-worker';
import { syncPersonalBests } from './syncPersonalBests';
import { updateLevelPointsHistoryBatch } from './updateLevelPointsHistoryBatch';
import { updateLevelPointsHistory } from './updateLevelPointsHistory';
import { updateLevelScore } from './updateLevelScore';
import { updateLevelScores } from './updateLevelScores';
import { updatePlayerScore } from './updatePlayerScore';
import { updatePlayerScores } from './updatePlayerScores';
import { updateUserPointsHistoryBatch } from './updateUserPointsHistoryBatch';
import { updateUserPointsHistory } from './updateUserPointsHistory';

type GWTask = (payload: unknown, helpers: Helpers) => Promise<void>;

// graphile-worker task list — keys must match the task name strings used in addJob()
export const taskList: Record<string, GWTask> = {
	syncPersonalBests: syncPersonalBests as GWTask,
	updateLevelPointsHistory: updateLevelPointsHistory as GWTask,
	updateLevelPointsHistoryBatch: updateLevelPointsHistoryBatch as GWTask,
	updateLevelScore: updateLevelScore as GWTask,
	updateLevelScores: updateLevelScores as GWTask,
	updatePlayerScore: updatePlayerScore as GWTask,
	updatePlayerScores: updatePlayerScores as GWTask,
	updateUserPointsHistory: updateUserPointsHistory as GWTask,
	updateUserPointsHistoryBatch: updateUserPointsHistoryBatch as GWTask,
};
