import { type SQL, sql } from 'drizzle-orm'
import { type DatabaseTransaction, db } from '../client'
import { levelPointsHistory, pointsHistoryPruneState, userPointsHistory } from '../schema'

export const POINTS_HISTORY_KINDS = ['level_points_history', 'user_points_history'] as const

export type PointsHistoryKind = (typeof POINTS_HISTORY_KINDS)[number]

export type PrunePointsHistoryBatchInput = {
	history: PointsHistoryKind
	pruneBefore: string
	budgetDate: string
	dailyDeleteLimit: number
	batchDeleteLimit: number
	entityLimit: number
}

export type PrunePointsHistoryBatchResult = {
	advancedWeeks: number
	capReached: boolean
	complete: boolean
	deletedRows: number
	weekStart: string
}

type PruneStateRow = {
	budgetDate: string
	deletedToday: number
	weekStart: string
}

type CountRow = { count: number }

function historyTable(history: PointsHistoryKind) {
	return history === 'level_points_history' ? levelPointsHistory : userPointsHistory
}

function assertPositiveInteger(value: number, name: string) {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`)
	}
}

export function buildLevelPointsHistoryPruneQuery(
	weekStart: string,
	entityLimit: number,
	deleteLimit: number,
): SQL {
	return sql`
		WITH candidate_entities AS MATERIALIZED (
			SELECT history.id_level
			FROM ${levelPointsHistory} AS history
			WHERE history.date_created >= ${weekStart}::timestamptz
				AND history.date_created < ${weekStart}::timestamptz + INTERVAL '1 week'
			GROUP BY history.id_level
			HAVING COUNT(*) > 1
			ORDER BY history.id_level
			LIMIT ${entityLimit}
		), annotated AS MATERIALIZED (
			SELECT
				history.id,
				history.id_level,
				history.points,
				history.date_created,
				FIRST_VALUE(history.points) OVER (
					PARTITION BY history.id_level
					ORDER BY history.date_created DESC, history.id DESC
				) AS latest_points
			FROM ${levelPointsHistory} AS history
			INNER JOIN candidate_entities AS candidate
				ON candidate.id_level = history.id_level
			WHERE history.date_created >= ${weekStart}::timestamptz
				AND history.date_created < ${weekStart}::timestamptz + INTERVAL '1 week'
		), ranked AS MATERIALIZED (
			SELECT
				annotated.id,
				annotated.id_level,
				ROW_NUMBER() OVER (
					PARTITION BY annotated.id_level
					ORDER BY
						CASE WHEN annotated.latest_points = 0 THEN annotated.date_created END DESC NULLS LAST,
						CASE WHEN annotated.latest_points <> 0 THEN annotated.points END DESC NULLS LAST,
						annotated.date_created DESC,
						annotated.id DESC
				) AS keeper_rank
			FROM annotated
		), deletable AS MATERIALIZED (
			SELECT ranked.id
			FROM ranked
			WHERE ranked.keeper_rank > 1
			ORDER BY ranked.id_level, ranked.id
			LIMIT ${deleteLimit}
		), deleted AS (
			DELETE FROM ${levelPointsHistory} AS history
			USING deletable
			WHERE history.id = deletable.id
			RETURNING history.id
		)
		SELECT COUNT(*)::integer AS count FROM deleted
	`
}

export function buildUserPointsHistoryPruneQuery(
	weekStart: string,
	entityLimit: number,
	deleteLimit: number,
): SQL {
	return sql`
		WITH candidate_entities AS MATERIALIZED (
			SELECT history.id_user
			FROM ${userPointsHistory} AS history
			WHERE history.date_created >= ${weekStart}::timestamptz
				AND history.date_created < ${weekStart}::timestamptz + INTERVAL '1 week'
			GROUP BY history.id_user
			HAVING COUNT(*) > 1
			ORDER BY history.id_user
			LIMIT ${entityLimit}
		), ranked AS MATERIALIZED (
			SELECT
				history.id,
				history.id_user,
				ROW_NUMBER() OVER (
					PARTITION BY history.id_user
					ORDER BY
						CASE WHEN history.rank > 0 THEN 0 ELSE 1 END,
						CASE WHEN history.rank > 0 THEN history.rank END ASC NULLS LAST,
						history.date_created DESC,
						history.id DESC
				) AS keeper_rank
			FROM ${userPointsHistory} AS history
			INNER JOIN candidate_entities AS candidate
				ON candidate.id_user = history.id_user
			WHERE history.date_created >= ${weekStart}::timestamptz
				AND history.date_created < ${weekStart}::timestamptz + INTERVAL '1 week'
		), deletable AS MATERIALIZED (
			SELECT ranked.id
			FROM ranked
			WHERE ranked.keeper_rank > 1
			ORDER BY ranked.id_user, ranked.id
			LIMIT ${deleteLimit}
		), deleted AS (
			DELETE FROM ${userPointsHistory} AS history
			USING deletable
			WHERE history.id = deletable.id
			RETURNING history.id
		)
		SELECT COUNT(*)::integer AS count FROM deleted
	`
}

async function initializeState(
	tx: DatabaseTransaction,
	history: PointsHistoryKind,
	pruneBefore: string,
	budgetDate: string,
) {
	const table = historyTable(history)
	await tx.execute(sql`
		INSERT INTO ${pointsHistoryPruneState} (history, week_start, budget_date, deleted_today)
		SELECT
			${history},
			COALESCE(
				date_trunc('week', MIN(${table.dateCreated}) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
				date_trunc('week', ${pruneBefore}::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
			),
			${budgetDate}::date,
			0
		FROM ${table}
		ON CONFLICT (history) DO NOTHING
	`)
}

async function lockState(
	tx: DatabaseTransaction,
	history: PointsHistoryKind,
): Promise<PruneStateRow> {
	const rows = await tx.execute<PruneStateRow>(sql`
		SELECT
			budget_date::text AS "budgetDate",
			deleted_today AS "deletedToday",
			week_start::text AS "weekStart"
		FROM ${pointsHistoryPruneState}
		WHERE history = ${history}
		FOR UPDATE
	`)
	const state = rows[0]
	if (!state) throw new Error(`Missing pruning state for ${history}.`)
	return state
}

async function resetDailyBudget(
	tx: DatabaseTransaction,
	history: PointsHistoryKind,
	budgetDate: string,
): Promise<PruneStateRow> {
	const rows = await tx.execute<PruneStateRow>(sql`
		UPDATE ${pointsHistoryPruneState}
		SET budget_date = ${budgetDate}::date,
			deleted_today = 0,
			date_updated = NOW()
		WHERE history = ${history}
		RETURNING
			budget_date::text AS "budgetDate",
			deleted_today AS "deletedToday",
			week_start::text AS "weekStart"
	`)
	const state = rows[0]
	if (!state) throw new Error(`Failed to reset pruning budget for ${history}.`)
	return state
}

async function advanceWeek(
	tx: DatabaseTransaction,
	history: PointsHistoryKind,
	weekStart: string,
	pruneBefore: string,
): Promise<string> {
	const table = historyTable(history)
	const rows = await tx.execute<{ weekStart: string }>(sql`
		UPDATE ${pointsHistoryPruneState} AS state
		SET week_start = COALESCE(
			(
				SELECT MIN(date_trunc('week', history.date_created AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
				FROM ${table} AS history
				WHERE history.date_created >= ${weekStart}::timestamptz + INTERVAL '1 week'
			),
			date_trunc('week', ${pruneBefore}::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
		),
		date_updated = NOW()
		WHERE state.history = ${history}
		RETURNING state.week_start::text AS "weekStart"
	`)
	const next = rows[0]
	if (!next) throw new Error(`Failed to advance pruning state for ${history}.`)
	return next.weekStart
}

export async function prunePointsHistoryBatch(
	input: PrunePointsHistoryBatchInput,
): Promise<PrunePointsHistoryBatchResult> {
	assertPositiveInteger(input.dailyDeleteLimit, 'dailyDeleteLimit')
	assertPositiveInteger(input.batchDeleteLimit, 'batchDeleteLimit')
	assertPositiveInteger(input.entityLimit, 'entityLimit')

	return db.transaction(async (tx) => {
		await initializeState(tx, input.history, input.pruneBefore, input.budgetDate)
		let state = await lockState(tx, input.history)
		if (state.budgetDate !== input.budgetDate) {
			state = await resetDailyBudget(tx, input.history, input.budgetDate)
		}

		const remaining = input.dailyDeleteLimit - state.deletedToday
		if (remaining <= 0) {
			return {
				advancedWeeks: 0,
				capReached: true,
				complete: false,
				deletedRows: 0,
				weekStart: state.weekStart,
			}
		}

		const eligibility = await tx.execute<{ eligible: boolean }>(sql`
			SELECT (${state.weekStart}::timestamptz + INTERVAL '1 week') <= ${input.pruneBefore}::timestamptz AS eligible
		`)
		if (eligibility[0]?.eligible !== true) {
			return {
				advancedWeeks: 0,
				capReached: false,
				complete: true,
				deletedRows: 0,
				weekStart: state.weekStart,
			}
		}

		const deleteLimit = Math.min(input.batchDeleteLimit, remaining)
		const query =
			input.history === 'level_points_history'
				? buildLevelPointsHistoryPruneQuery(state.weekStart, input.entityLimit, deleteLimit)
				: buildUserPointsHistoryPruneQuery(state.weekStart, input.entityLimit, deleteLimit)
		const deletedRows = Number((await tx.execute<CountRow>(query))[0]?.count ?? 0)

		if (deletedRows > 0) {
			await tx.execute(sql`
				UPDATE ${pointsHistoryPruneState}
				SET deleted_today = deleted_today + ${deletedRows},
					date_updated = NOW()
				WHERE history = ${input.history}
			`)
			return {
				advancedWeeks: 0,
				capReached: state.deletedToday + deletedRows >= input.dailyDeleteLimit,
				complete: false,
				deletedRows,
				weekStart: state.weekStart,
			}
		}

		const weekStart = await advanceWeek(tx, input.history, state.weekStart, input.pruneBefore)
		return {
			advancedWeeks: 1,
			capReached: false,
			complete: false,
			deletedRows: 0,
			weekStart,
		}
	})
}
