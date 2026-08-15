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
	let resultSummary: string
	let resultMetadata: Record<string, number>
	if (payload.all) {
		const result = await syncChangedLevelPointContributionValues()
		resultSummary = `updated=${result.updated} deleted=${result.deleted} fallbackLevels=${result.fallbackLevels} users=${result.users}`
		resultMetadata = {
			deleted: result.deleted,
			fallbackLevels: result.fallbackLevels,
			updated: result.updated,
			users: result.users,
		}
	} else {
		const result = await syncUserPointContributionLevels(payload.ids ?? [])
		resultSummary = `levels=${result.levels} users=${result.users}`
		resultMetadata = { levels: result.levels, users: result.users }
	}
	const durationMs = Date.now() - startedAt

	helpers.logger.info(
		`Level score contribution finalizer completed: run=${payload.runId} mode=${payload.all ? 'delta' : 'projection'} ${resultSummary} duration=${durationMs}ms.`,
		{ ...resultMetadata, all: payload.all, durationMs, runId: payload.runId },
	)
	await helpers.addJob('updatePlayerScores', {}, playerScoreJobOptions('updatePlayerScores', {}))
}
