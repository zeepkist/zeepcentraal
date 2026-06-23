import { batchProcess } from './batchProcess'

export const LEVEL_SCORE_BATCH_SIZE = 50

export function createLevelScoreBatchJobs(levelIds: number[], personalBestCountPercentile: number) {
	return Array.from(batchProcess(levelIds, LEVEL_SCORE_BATCH_SIZE), (ids) => ({
		identifier: 'updateLevelScoresBatch' as const,
		payload: { ids, personalBestCountPercentile },
		jobKey: `update-level-scores-batch:${ids.join('-')}`,
	}))
}
