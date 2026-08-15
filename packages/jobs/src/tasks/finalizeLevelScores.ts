import {
	syncChangedLevelPointContributionValues,
	syncUserPointContributionLevels,
} from '@zeepkist/database'
import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import type { TaskHandler } from './types'
import type { LevelScoreFinalizationPayload } from './updateLevelScoresBarrier'

export const finalizeLevelScores: TaskHandler<LevelScoreFinalizationPayload> = async (
	payload,
	helpers,
) => {
	const startedAt = Date.now()
	const result = payload.all
		? await syncChangedLevelPointContributionValues()
		: await syncUserPointContributionLevels(payload.ids ?? [])
	const durationMs = Date.now() - startedAt

	helpers.logger.info(
		`Level score contribution finalizer: run=${payload.runId} mode=${payload.all ? 'delta' : 'projection'} duration=${durationMs}ms.`,
		{ ...result, all: payload.all, durationMs, runId: payload.runId },
	)
	await helpers.addJob('updatePlayerScores', {}, playerScoreJobOptions('updatePlayerScores', {}))
}
