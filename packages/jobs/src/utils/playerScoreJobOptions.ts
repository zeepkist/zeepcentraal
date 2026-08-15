export const PLAYER_SCORE_QUEUE_NAME = 'player-score-writes'
export const UPDATE_PLAYER_SCORES_JOB_KEY = 'update-player-scores'

export function playerScoreJobOptions(
	task: string,
	payload: Record<string, unknown>,
): { jobKey?: string; queueName?: string } {
	if (task === 'updatePlayerScores') {
		return {
			jobKey: UPDATE_PLAYER_SCORES_JOB_KEY,
			queueName: PLAYER_SCORE_QUEUE_NAME,
		}
	}
	if (task === 'updatePlayerScore' && typeof payload.idUser === 'number') {
		return {
			jobKey: `update-player-score:${payload.idUser}`,
			queueName: PLAYER_SCORE_QUEUE_NAME,
		}
	}
	return {}
}
