import {
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
} from '@zeepkist/database'
import { batchProcess, runWithConcurrency } from '../utils'
import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
	reportOnly?: boolean
}

export const RECENT_LEVEL_SCORE_LOOKBACK_MS = 60 * 60 * 1000
export const LEVEL_SCORE_BATCH_SIZE = 50
export const LEVEL_SCORE_BATCH_CONCURRENCY = 2

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	if (all) {
		helpers.logger.info('Rebuilding independent player-skill aggregates.')
		const rebuilt = await rebuildPlayerSkillAggregates()
		helpers.logger.info(`Rebuilt independent player skill for ${rebuilt} players.`)
	}
	const levelIds = all
		? await getAllLevelIds()
		: await getAllLevelIdsWithRecordsSince(
				new Date(Date.now() - RECENT_LEVEL_SCORE_LOOKBACK_MS),
			)

	helpers.logger.info(`updateLevelScores starting with ${levelIds.length} levels (all=${all}).`)
	if (levelIds.length === 0) {
		return
	}

	const startedAt = Date.now()
	const batches = Array.from(batchProcess(levelIds, LEVEL_SCORE_BATCH_SIZE))
	let processed = 0
	let updated = 0
	let zeroed = 0
	let reported = 0
	const affectedUsers = new Set<number>()

	await runWithConcurrency(batches, LEVEL_SCORE_BATCH_CONCURRENCY, async (ids, batchIndex) => {
		const batchStartedAt = Date.now()
		const result = await updateLevelScoreBatch({
			idLevels: ids,
			reportOnly: payload.reportOnly,
			logger: helpers.logger,
		})
		processed += ids.length
		updated += result.updated
		zeroed += result.zeroed
		reported += result.reported
		for (const idUser of result.affectedUserIds) affectedUsers.add(idUser)

		const elapsedMs = Date.now() - startedAt
		const progress = (processed / levelIds.length) * 100
		const etaMs = Math.round((elapsedMs / processed) * (levelIds.length - processed))
		helpers.logger.info(`Completed level score batch ${batchIndex + 1}/${batches.length}.`, {
			all,
			batchMs: Date.now() - batchStartedAt,
			etaMs,
			processedLevels: processed,
			progress: Number(progress.toFixed(2)),
			totalLevels: levelIds.length,
			updated: result.updated,
			zeroed: result.zeroed,
			reported: result.reported,
			affectedUsers: result.affectedUserIds.length,
			elapsedMs,
		})
	})

	helpers.logger.info('updateLevelScores completed.', {
		all,
		affectedUsers: affectedUsers.size,
		durationMs: Date.now() - startedAt,
		processed,
		reportOnly: payload.reportOnly === true,
		reported,
		updated,
		zeroed,
	})

	if (!payload.reportOnly) {
		await helpers.addJob(
			'updatePlayerScores',
			{},
			playerScoreJobOptions('updatePlayerScores', {}),
		)
		helpers.logger.info('Queued player-score recalculation after level scores completed.')
	}
}
