import { getLevelIdsPage, rebuildPlayerSkillAggregates } from '@zeepkist/database'
import { updateLevelScoreBatch } from '@zeepkist/database/services'
import { batchProcess, runWithConcurrency } from '../utils'
import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import type { TaskHandler } from './types'

type Payload = {
	all?: boolean
	reportOnly?: boolean
}

export const RECENT_LEVEL_SCORE_LOOKBACK_MS = 60 * 60 * 1000
export const LEVEL_SCORE_BATCH_SIZE = 50
export const LEVEL_SCORE_PAGE_SIZE = 200
const LEVEL_SCORE_CONCURRENCY = 4

export const updateLevelScores: TaskHandler<Payload> = async (payload, helpers) => {
	const { all = false } = payload
	if (all) {
		helpers.logger.info('Rebuilding independent player-skill aggregates.')
		const rebuilt = await rebuildPlayerSkillAggregates()
		helpers.logger.info(`Rebuilt independent player skill for ${rebuilt} players.`)
	}
	const startedAt = Date.now()
	const recordsSince = all ? undefined : new Date(Date.now() - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	helpers.logger.info(`updateLevelScores starting (all=${all}).`)
	let processed = 0
	let updated = 0
	let zeroed = 0
	let reported = 0
	const affectedUsers = new Set<number>()

	let afterId = 0
	let pageIndex = 0
	while (true) {
		const levelPage = await getLevelIdsPage({
			afterId,
			limit: LEVEL_SCORE_PAGE_SIZE,
			...(recordsSince ? { recordsSince } : {}),
		})
		if (levelPage.length === 0) break
		const batches = Array.from(batchProcess(levelPage, LEVEL_SCORE_BATCH_SIZE))
		await runWithConcurrency(batches, LEVEL_SCORE_CONCURRENCY, async (ids, batchIndex) => {
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
			helpers.logger.info(
				`Completed level score page ${pageIndex + 1}, batch ${batchIndex + 1}/${batches.length}.`,
				{
					all,
					batchMs: Date.now() - batchStartedAt,
					processedLevels: processed,
					updated: result.updated,
					zeroed: result.zeroed,
					reported: result.reported,
					affectedUsers: result.affectedUserIds.length,
					elapsedMs,
				},
			)
		})
		afterId = levelPage.at(-1) ?? afterId
		const finished = levelPage.length < LEVEL_SCORE_PAGE_SIZE
		batches.length = 0
		levelPage.length = 0
		pageIndex++
		if (finished) break
	}

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
