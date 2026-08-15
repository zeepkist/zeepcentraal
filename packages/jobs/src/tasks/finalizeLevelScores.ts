import {
	syncChangedLevelPointContributionValues,
	syncUserPointContributionLevels,
} from '@zeepkist/database'
import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import { createTaskPhaseLogger } from '../utils/taskPhaseLogger'
import type { TaskHandler } from './types'
import type { LevelScoreFinalizationPayload } from './updateLevelScoresBarrier'

export const finalizeLevelScores: TaskHandler<LevelScoreFinalizationPayload> = async (
	payload,
	helpers,
) => {
	const startedAt = Date.now()
	const phaseLogger = createTaskPhaseLogger({
		logger: helpers.logger,
		metadata: { all: payload.all, runId: payload.runId },
		scope: 'Level score contribution finalizer',
	})
	let resultSummary: string
	let resultMetadata: Record<string, number>
	if (payload.all) {
		const result = await phaseLogger.run('transaction', () =>
			syncChangedLevelPointContributionValues({ runPhase: phaseLogger.run }),
		)
		resultSummary = `updated=${result.updated} deleted=${result.deleted} fallbackLevels=${result.fallbackLevels} users=${result.users}`
		resultMetadata = {
			deleted: result.deleted,
			fallbackLevels: result.fallbackLevels,
			updated: result.updated,
			users: result.users,
		}
	} else {
		const result = await phaseLogger.run('transaction', () =>
			syncUserPointContributionLevels(payload.ids ?? [], { runPhase: phaseLogger.run }),
		)
		resultSummary = `levels=${result.levels} users=${result.users}`
		resultMetadata = { levels: result.levels, users: result.users }
	}
	const durationMs = Date.now() - startedAt

	helpers.logger.info(
		`Level score contribution finalizer completed: run=${payload.runId} mode=${payload.all ? 'delta' : 'projection'} ${resultSummary} duration=${durationMs}ms.`,
		{ ...resultMetadata, all: payload.all, durationMs, runId: payload.runId },
	)
	await phaseLogger.run('playerRefreshEnqueue', () =>
		helpers.addJob('updatePlayerScores', {}, playerScoreJobOptions('updatePlayerScores', {})),
	)
}
