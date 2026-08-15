import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from '../priorities'
import { LEVEL_SCORE_QUEUE_NAMES } from '../utils/createLevelScoreBatchJobs'
import { PLAYER_SCORE_QUEUE_NAME } from '../utils/playerScoreJobOptions'
import type { TaskHandler } from './types'

export type LevelScoreFinalizationPayload = {
	all: boolean
	ids?: number[]
	runId: string
}

type Payload = LevelScoreFinalizationPayload & {
	phase: 'queue0' | 'queue1'
}

export const updateLevelScoresBarrier: TaskHandler<Payload> = async (payload, helpers) => {
	const priority = payload.all ? DEFAULT_JOB_PRIORITY : PRIORITY_JOB_PRIORITY
	if (payload.phase === 'queue0') {
		await helpers.addJob(
			'updateLevelScoresBarrier',
			{ ...payload, phase: 'queue1' },
			{
				jobKey: `update-level-scores-barrier:${payload.runId}:queue1`,
				priority,
				queueName: LEVEL_SCORE_QUEUE_NAMES[1],
			},
		)
		helpers.logger.info(`Level score run ${payload.runId} cleared queue 0.`)
		return
	}

	const { phase: _, ...finalizationPayload } = payload
	await helpers.addJob('finalizeLevelScores', finalizationPayload, {
		jobKey: `finalize-level-scores:${payload.runId}`,
		priority,
		queueName: PLAYER_SCORE_QUEUE_NAME,
	})
	helpers.logger.info(`Level score run ${payload.runId} cleared both batch queues.`)
}
