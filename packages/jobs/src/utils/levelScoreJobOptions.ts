import { PLAYER_SCORE_QUEUE_NAME } from './playerScoreJobOptions'

export function levelScoreJobOptions(
	task: string,
	payload: Record<string, unknown>,
): { jobKey?: string; queueName?: string } {
	const reportOnly = payload.reportOnly === true
	if (task === 'updateLevelScore' && typeof payload.idLevel === 'number') {
		return {
			jobKey: `update-level-score${reportOnly ? '-report' : ''}:${payload.idLevel}`,
			...(!reportOnly && { queueName: PLAYER_SCORE_QUEUE_NAME }),
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
