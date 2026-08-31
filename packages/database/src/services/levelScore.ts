import {
	calculateLevelPointsV2,
	calculateVoteRating,
	getVoteRatingMaturityCutoff,
	isLevelScoreEligible,
	type LevelScorePersonalBest,
	type LevelScoreTelemetry,
} from '@zeepkist/core/score'
import { sql } from 'drizzle-orm'
import { type DatabaseExecutor, type DatabaseTransaction, db } from '../client'
import {
	getLevelPointValuesByIds,
	setLevelPointsToZeroBulk,
	type UpdateLevelPointsPayload,
	upsertLevelPointsBulk,
} from './levelPoints'
import { getLevelSkillMetricsByLevelIds } from './playerSkill'
import { getV2ScorePersonalBestsByLevelIds } from './record'
import { syncUserPointContributionLevels } from './userPointContribution'
import { getVoteValuesByLevelIds } from './vote'
import { getLevelWorkshopAvailabilities } from './workshop'

type PersonalBestRow = Awaited<ReturnType<typeof getV2ScorePersonalBestsByLevelIds>>[number]

export interface LevelScoreBatchLogger {
	info(message: string, metadata?: Record<string, unknown>): void
}

export interface LevelScoreBatchResult {
	affectedUserIds: number[]
	reported: number
	updated: number
	zeroed: number
}

export interface UpdateLevelScoreBatchInput {
	idLevels: number[]
	logger?: LevelScoreBatchLogger
	reportOnly?: boolean
}

function mapTelemetry(row: PersonalBestRow): LevelScoreTelemetry | null {
	const hasStatistic = row.statisticTime !== null || row.hasInputData !== null
	if (!hasStatistic) return null

	return {
		time: row.statisticTime,
		turnLeftCount: row.turnLeftCount,
		turnLeftTime: row.turnLeftTime,
		turnRightCount: row.turnRightCount,
		turnRightTime: row.turnRightTime,
		brakeCount: row.brakeCount,
		brakeTime: row.brakeTime,
		armsUpCount: row.armsUpCount,
		armsUpTime: row.armsUpTime,
		driverInputTransitionCount: row.driverInputTransitionCount,
		hasInputData: row.hasInputData,
	}
}

function mapPersonalBest(row: PersonalBestRow): LevelScorePersonalBest {
	return {
		time: row.time,
		splits: row.splits?.map((time) => ({ time })),
		telemetry: mapTelemetry(row),
	}
}

async function calculateLevelScoreBatch(
	idLevels: number[],
	reportOnly: boolean,
	logger: LevelScoreBatchLogger | undefined,
	executor: DatabaseExecutor,
	transaction?: DatabaseTransaction,
): Promise<LevelScoreBatchResult> {
	const startedAt = Date.now()
	const logTimings = (contributionProjectionMs: number, metadata: Record<string, unknown>) => {
		const totalMs = Date.now() - startedAt
		logger?.info(
			`Level score batch timings: contributionProjection=${contributionProjectionMs}ms total=${totalMs}ms.`,
			{
				contributionProjectionMs,
				totalMs,
				...metadata,
			},
		)
	}

	const availabilityByLevel = await getLevelWorkshopAvailabilities(idLevels, executor)
	const eligibleIds = idLevels.filter((idLevel) =>
		isLevelScoreEligible(
			availabilityByLevel.get(idLevel) ?? {
				adventure: false,
				itemCount: 0,
				accessibleItemCount: 0,
			},
		),
	)
	const eligibleIdSet = new Set(eligibleIds)
	const zeroIds = idLevels.filter((idLevel) => !eligibleIdSet.has(idLevel))
	const [personalBests, skillMetricsByLevel, voteValuesByLevel] =
		eligibleIds.length > 0
			? await Promise.all([
					getV2ScorePersonalBestsByLevelIds({ idLevels: eligibleIds }, executor),
					getLevelSkillMetricsByLevelIds(eligibleIds, executor),
					getVoteValuesByLevelIds(eligibleIds, getVoteRatingMaturityCutoff(), executor),
				])
			: [[], new Map(), new Map()]

	const personalBestsByLevel = new Map<number, PersonalBestRow[]>()
	for (const personalBest of personalBests) {
		const entries = personalBestsByLevel.get(personalBest.idLevel) ?? []
		entries.push(personalBest)
		personalBestsByLevel.set(personalBest.idLevel, entries)
	}

	const updates: UpdateLevelPointsPayload[] = []
	for (const idLevel of eligibleIds) {
		const levelPersonalBests = personalBestsByLevel.get(idLevel) ?? []
		const matureVotes = voteValuesByLevel.get(idLevel) ?? []
		const rating = calculateVoteRating(matureVotes)
		const score = calculateLevelPointsV2({
			personalBests: levelPersonalBests.map(mapPersonalBest),
			personalBestCount: Number(levelPersonalBests.at(0)?.totalCount ?? 0),
			skill: skillMetricsByLevel.get(idLevel) ?? null,
			voteRating: rating,
			matureVoteCount: matureVotes.length,
		})
		const { metrics, factors } = score

		updates.push({
			idLevel,
			points: score.points,
			rating,
			lengthModifier: factors.lengthFactor,
			evidenceModifier: factors.evidenceFactor,
			qualityModifier: factors.qualityFactor,
			ratingModifier: factors.voteFactor,
			complexityConfidence: metrics.complexityConfidence,
			complexityScore: metrics.complexityScore,
			fieldStrength: metrics.fieldStrength,
			qualityScore: metrics.qualityScore,
			skillAlignment: metrics.skillAlignment,
			skillConfidence: metrics.skillConfidence,
			skillSampleSize: metrics.skillSampleSize,
			skillScore: metrics.skillScore,
			skillSeparation: metrics.skillSeparation,
		})
	}

	const currentLevelPoints = await getLevelPointValuesByIds(idLevels, executor)
	const currentByLevel = new Map(currentLevelPoints.map((entry) => [entry.idLevel, entry.points]))

	if (reportOnly) {
		logger?.info('Calculated report-only level scores.', {
			levels: updates.map((update) => {
				const currentPoints = currentByLevel.get(update.idLevel) ?? null
				return {
					idLevel: update.idLevel,
					currentPoints,
					proposedPoints: update.points,
					delta: currentPoints === null ? null : update.points - currentPoints,
					complexityScore: update.complexityScore,
					evidenceFactor: update.evidenceModifier,
					lengthFactor: update.lengthModifier,
					qualityScore: update.qualityScore,
					skillConfidence: update.skillConfidence,
					skillScore: update.skillScore,
					voteFactor: update.ratingModifier,
				}
			}),
			zeroedLevelIds: zeroIds,
		})
		logTimings(0, {
			requested: idLevels.length,
			eligible: eligibleIds.length,
			zeroed: zeroIds.length,
			persisted: 0,
			pointChanged: 0,
			projectionLevels: 0,
			projectionUsers: 0,
			reportOnly: true,
		})
		return {
			affectedUserIds: [],
			updated: 0,
			zeroed: 0,
			reported: updates.length + zeroIds.length,
		}
	}

	if (!transaction) throw new Error('Persistent level scoring requires a database transaction')
	const proposedPoints = new Map(updates.map((update) => [update.idLevel, update.points]))
	for (const idLevel of zeroIds) proposedPoints.set(idLevel, 0)
	const pointChangedIds = idLevels.filter(
		(idLevel) =>
			!currentByLevel.has(idLevel) ||
			currentByLevel.get(idLevel) !== proposedPoints.get(idLevel),
	)
	const updatedIds = await upsertLevelPointsBulk(updates, executor)
	const zeroedIds = await setLevelPointsToZeroBulk(zeroIds, executor)
	const contributionProjectionStartedAt = Date.now()
	const projection = await syncUserPointContributionLevels(idLevels, { transaction })
	const contributionProjectionMs = Date.now() - contributionProjectionStartedAt
	logTimings(contributionProjectionMs, {
		requested: idLevels.length,
		eligible: eligibleIds.length,
		zeroed: zeroIds.length,
		persisted: updatedIds.length + zeroedIds.length,
		pointChanged: pointChangedIds.length,
		projectionLevels: projection.levels,
		projectionUsers: projection.users,
		reportOnly: false,
	})
	return {
		affectedUserIds: projection.idUsers,
		updated: updatedIds.length,
		zeroed: zeroedIds.length,
		reported: 0,
	}
}

export async function updateLevelScoreBatch({
	idLevels,
	reportOnly = false,
	logger,
}: UpdateLevelScoreBatchInput): Promise<LevelScoreBatchResult> {
	const uniqueLevelIds = [...new Set(idLevels)].sort((left, right) => left - right)
	if (uniqueLevelIds.length === 0) {
		return { affectedUserIds: [], updated: 0, zeroed: 0, reported: 0 }
	}

	if (reportOnly) {
		return calculateLevelScoreBatch(uniqueLevelIds, true, logger, db)
	}

	return db.transaction(async (tx) => {
		await tx.execute(sql`
			SELECT pg_advisory_xact_lock(0, lock_target.id_level)
			FROM UNNEST(${sql.param(uniqueLevelIds)}::integer[]) AS lock_target(id_level)
			ORDER BY lock_target.id_level
		`)
		return calculateLevelScoreBatch(uniqueLevelIds, false, logger, tx, tx)
	})
}
