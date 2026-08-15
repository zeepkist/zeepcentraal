import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from '../priorities'
import { batchProcess } from './batchProcess'

export const LEVEL_SCORE_BATCH_SIZE = 100
export const LEVEL_SCORE_QUEUE_NAMES = ['level-score-batch-0', 'level-score-batch-1'] as const

export function createLevelScoreBatchJobs(
	levelIds: number[],
	reportOnly = false,
	incremental = false,
) {
	return Array.from(batchProcess(levelIds, LEVEL_SCORE_BATCH_SIZE), (ids, index) => ({
		identifier: 'updateLevelScoresBatch' as const,
		payload: { ids, reportOnly },
		jobKey: `update-level-scores-batch${reportOnly ? '-report' : ''}:${ids.join('-')}`,
		priority: incremental ? PRIORITY_JOB_PRIORITY : DEFAULT_JOB_PRIORITY,
		queueName: LEVEL_SCORE_QUEUE_NAMES[index % LEVEL_SCORE_QUEUE_NAMES.length],
	}))
}
