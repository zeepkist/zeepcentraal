import { PLAYER_SCORE_QUEUE_NAME } from './playerScoreJobOptions'

export const LEVEL_SCORE_QUEUE_COUNT = 4
export const LEVEL_SCORE_QUEUE_PREFIX = 'level-score-writes'

export function levelScoreQueueName(idLevel: number): string {
	return `${LEVEL_SCORE_QUEUE_PREFIX}:${idLevel % LEVEL_SCORE_QUEUE_COUNT}`
}

export function levelScoreJobOptions(
	task: string,
	payload: Record<string, unknown>,
): { jobKey?: string; queueName?: string } {
	const reportOnly = payload.reportOnly === true
	if (task === 'updateLevelScore' && typeof payload.idLevel === 'number') {
		return {
			jobKey: `update-level-score${reportOnly ? '-report' : ''}:${payload.idLevel}`,
			...(!reportOnly && { queueName: levelScoreQueueName(payload.idLevel) }),
		}
	}

	if (task === 'updateLevelScores') {
		const scope = payload.all === true ? 'full' : 'incremental'
		return {
			jobKey: `update-level-scores${reportOnly ? '-report' : ''}:${scope}`,
			...(!reportOnly && { queueName: PLAYER_SCORE_QUEUE_NAME }),
		}
	}

	return {}
}
