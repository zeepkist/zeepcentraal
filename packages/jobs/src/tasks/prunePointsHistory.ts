import {
	POINTS_HISTORY_KINDS,
	type PointsHistoryKind,
	prunePointsHistoryBatch,
} from '@zeepkist/database/services'
import {
	POINTS_HISTORY_PRUNE_AGE_DAYS,
	POINTS_HISTORY_PRUNE_BATCH_DELETE_LIMIT,
	POINTS_HISTORY_PRUNE_DAILY_DELETE_LIMIT,
	POINTS_HISTORY_PRUNE_ENTITY_LIMIT,
} from '../utils/pointsHistoryPruningOptions'
import type { TaskHandler } from './types'

const DAY_MS = 24 * 60 * 60 * 1_000

type Payload = Record<string, never>

type HistoryResult = {
	advancedWeeks: number
	capReached: boolean
	complete: boolean
	deletedRows: number
	history: PointsHistoryKind
}

export function getPointsHistoryPruneWindow(now = new Date()) {
	return {
		budgetDate: now.toISOString().slice(0, 10),
		pruneBefore: new Date(now.getTime() - POINTS_HISTORY_PRUNE_AGE_DAYS * DAY_MS).toISOString(),
	}
}

async function pruneHistory(
	history: PointsHistoryKind,
	pruneBefore: string,
	budgetDate: string,
): Promise<HistoryResult> {
	let advancedWeeks = 0
	let deletedRows = 0

	while (true) {
		const batch = await prunePointsHistoryBatch({
			history,
			pruneBefore,
			budgetDate,
			dailyDeleteLimit: POINTS_HISTORY_PRUNE_DAILY_DELETE_LIMIT,
			batchDeleteLimit: POINTS_HISTORY_PRUNE_BATCH_DELETE_LIMIT,
			entityLimit: POINTS_HISTORY_PRUNE_ENTITY_LIMIT,
		})
		advancedWeeks += batch.advancedWeeks
		deletedRows += batch.deletedRows

		if (batch.complete || batch.capReached) {
			return {
				advancedWeeks,
				capReached: batch.capReached,
				complete: batch.complete,
				deletedRows,
				history,
			}
		}

		if (batch.advancedWeeks === 0 && batch.deletedRows === 0) {
			throw new Error(`Points history pruning made no progress for ${history}.`)
		}
	}
}

export const prunePointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const startedAt = new Date()
	const started = performance.now()
	const { budgetDate, pruneBefore } = getPointsHistoryPruneWindow(startedAt)
	const results: HistoryResult[] = []
	const failures: unknown[] = []

	helpers.logger.info('prunePointsHistory started.', {
		budgetDate,
		dailyDeleteLimit: POINTS_HISTORY_PRUNE_DAILY_DELETE_LIMIT,
		pruneBefore,
	})

	for (const history of POINTS_HISTORY_KINDS) {
		try {
			const result = await pruneHistory(history, pruneBefore, budgetDate)
			results.push(result)
			helpers.logger.info('Points history pruning table completed.', result)
		} catch (error) {
			failures.push(error)
			helpers.logger.error('Points history pruning table failed.', { error, history })
		}
	}

	helpers.logger.info('prunePointsHistory completed.', {
		budgetDate,
		pruneBefore,
		results,
		totalMs: Math.round(performance.now() - started),
	})

	if (failures.length > 0) throw failures[0]
}
