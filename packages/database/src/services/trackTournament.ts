import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../client'
import { trackTournament, trackTournamentResult } from '../schema'
import {
	getTrackTournamentPeriod,
	isTrackTournamentBoundary,
	TRACK_TOURNAMENT_TYPE,
	type TrackTournamentType,
} from './trackTournamentHelpers'

export * from './trackTournamentHelpers'

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const TRACK_TOURNAMENT_LOCK_NAMESPACE = 1_953_744_431

async function rerankTrackTournaments(
	tx: DatabaseTransaction,
	idTournaments: readonly number[],
): Promise<void> {
	if (idTournaments.length === 0) return
	await tx.execute(sql`
		WITH next_results AS (
			SELECT
				result.id_tournament,
				result.id_user,
				RANK() OVER (
					PARTITION BY result.id_tournament
					ORDER BY result.time
				)::integer AS next_rank
			FROM ${trackTournamentResult} AS result
			WHERE result.id_tournament IN (${sql.join(
				idTournaments.map((id) => sql`${id}`),
				sql`, `,
			)})
		), scored_results AS (
			SELECT
				next_result.id_tournament,
				next_result.id_user,
				next_result.next_rank,
				GREATEST(
					2,
					(2 * CEIL((1000 * POWER(0.96, next_result.next_rank - 1)) / 2))::integer
				) AS next_points
			FROM next_results AS next_result
		)
		UPDATE ${trackTournamentResult} AS result
		SET
			rank = scored_result.next_rank,
			points = scored_result.next_points,
			date_updated = clock_timestamp()
		FROM scored_results AS scored_result
		WHERE result.id_tournament = scored_result.id_tournament
			AND result.id_user = scored_result.id_user
			AND ROW(result.rank, result.points)
				IS DISTINCT FROM ROW(scored_result.next_rank, scored_result.next_points)
	`)
}

export async function recordTrackTournamentResults(
	tx: DatabaseTransaction,
	input: { acceptedAt: string; idLevel: number; idRecord: number; idUser: number; time: number },
): Promise<void> {
	const tournaments = await tx
		.select({ id: trackTournament.id })
		.from(trackTournament)
		.where(
			and(
				eq(trackTournament.idLevel, input.idLevel),
				isNull(trackTournament.finalizedAt),
				lte(trackTournament.startAt, input.acceptedAt),
				gt(trackTournament.endAt, input.acceptedAt),
			),
		)
	if (tournaments.length === 0) return

	const now = new Date().toISOString()
	await tx
		.insert(trackTournamentResult)
		.values(
			tournaments.map((tournament) => ({
				idTournament: tournament.id,
				idUser: input.idUser,
				idRecord: input.idRecord,
				time: input.time,
				rank: 1,
				points: 1000,
				dateCreated: now,
				dateUpdated: now,
			})),
		)
		.onConflictDoUpdate({
			target: [trackTournamentResult.idTournament, trackTournamentResult.idUser],
			set: {
				idRecord: sql`EXCLUDED.id_record`,
				time: sql`EXCLUDED.time`,
				dateUpdated: sql`EXCLUDED.date_updated`,
			},
			where: sql`EXCLUDED.time < ${trackTournamentResult.time}`,
		})

	await rerankTrackTournaments(
		tx,
		tournaments.map((tournament) => tournament.id),
	)
}

async function selectTrackTournamentLevel(tx: DatabaseTransaction, type: TrackTournamentType) {
	const selected = await tx.execute<{
		id_level: number
	}>(sql`
		WITH eligible_levels AS MATERIALIZED (
			SELECT scored_level.id_level, scored_level.points
			FROM public.level_points AS scored_level
			INNER JOIN public.level AS candidate_level
				ON candidate_level.id = scored_level.id_level
				AND candidate_level.publicly_visible = true
			WHERE EXISTS (
				SELECT 1
				FROM public.level_item AS display_item
				WHERE display_item.id_level = candidate_level.id
					AND display_item.publicly_visible = true
					AND display_item.deleted = false
			)
		), threshold AS (
			SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY eligible_level.points) AS points
			FROM eligible_levels AS eligible_level
		)
		SELECT eligible_level.id_level
		FROM eligible_levels AS eligible_level
		CROSS JOIN threshold
		WHERE eligible_level.points >= threshold.points
			AND NOT EXISTS (
				SELECT 1
				FROM ${trackTournament} AS used_tournament
				WHERE used_tournament.type = ${type}
					AND used_tournament.id_level = eligible_level.id_level
			)
		ORDER BY random()
		LIMIT 1
	`)
	return selected[0]?.id_level
}

export async function rotateTrackTournament(
	type: TrackTournamentType,
	at = new Date(),
): Promise<{ created: boolean; reason?: 'empty-pool' | 'not-boundary' }> {
	if (!isTrackTournamentBoundary(type, at)) return { created: false, reason: 'not-boundary' }
	const period = getTrackTournamentPeriod(type, at)

	return db.transaction(async (tx) => {
		await tx.execute(
			sql`SELECT pg_advisory_xact_lock(${TRACK_TOURNAMENT_LOCK_NAMESPACE}, ${type})`,
		)
		const unfinished = await tx
			.select({
				id: trackTournament.id,
				idLevel: trackTournament.idLevel,
			})
			.from(trackTournament)
			.where(
				and(
					eq(trackTournament.type, type),
					isNull(trackTournament.finalizedAt),
					lte(trackTournament.endAt, at.toISOString()),
				),
			)
		for (const tournament of unfinished) {
			await tx.execute(sql`SELECT pg_advisory_xact_lock(0, ${tournament.idLevel})`)
			await rerankTrackTournaments(tx, [tournament.id])
			await tx
				.update(trackTournament)
				.set({ finalizedAt: at.toISOString(), dateUpdated: at.toISOString() })
				.where(eq(trackTournament.id, tournament.id))
		}

		const existing = await tx
			.select({ id: trackTournament.id })
			.from(trackTournament)
			.where(
				and(
					eq(trackTournament.type, type),
					eq(trackTournament.startAt, period.start.toISOString()),
				),
			)
			.limit(1)
		if (existing.length > 0) return { created: false }

		const idLevel = await selectTrackTournamentLevel(tx, type)
		if (!idLevel) return { created: false, reason: 'empty-pool' }
		await tx.execute(sql`SELECT pg_advisory_xact_lock(0, ${idLevel})`)
		const [created] = await tx
			.insert(trackTournament)
			.values({
				type,
				slug: period.slug,
				idLevel,
				startAt: period.start.toISOString(),
				endAt: period.end.toISOString(),
				pointsVersion: 1,
				dateCreated: at.toISOString(),
				dateUpdated: at.toISOString(),
			})
			.returning({ id: trackTournament.id })
		if (!created) return { created: false }
		return { created: true }
	})
}

export async function seedLocalTrackTournaments(idLevel: number, at = new Date()): Promise<void> {
	for (const type of [TRACK_TOURNAMENT_TYPE.weekly, TRACK_TOURNAMENT_TYPE.monthly] as const) {
		const period = getTrackTournamentPeriod(type, at)
		await db.transaction(async (tx) => {
			const [existing] = await tx
				.select({
					id: trackTournament.id,
					startAt: trackTournament.startAt,
					finalizedAt: trackTournament.finalizedAt,
				})
				.from(trackTournament)
				.where(and(eq(trackTournament.type, type), eq(trackTournament.idLevel, idLevel)))
				.limit(1)
			if (existing?.startAt === period.start.toISOString() && !existing.finalizedAt) return
			if (existing) {
				await tx
					.delete(trackTournamentResult)
					.where(eq(trackTournamentResult.idTournament, existing.id))
				await tx
					.update(trackTournament)
					.set({
						slug: period.slug,
						startAt: period.start.toISOString(),
						endAt: period.end.toISOString(),
						finalizedAt: null,
						dateUpdated: at.toISOString(),
					})
					.where(eq(trackTournament.id, existing.id))
				return
			}
			await tx.insert(trackTournament).values({
				type,
				slug: period.slug,
				idLevel,
				startAt: period.start.toISOString(),
				endAt: period.end.toISOString(),
				pointsVersion: 1,
				dateCreated: at.toISOString(),
				dateUpdated: at.toISOString(),
			})
		})
	}
}
