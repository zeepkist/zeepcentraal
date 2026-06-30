import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { userPointContribution } from '../schema'

export interface UserPointContributionInput {
	idUser: number
	idLevel: number
	idRecord: number
	contributionRank: number
	levelPosition: number
	levelPoints: number
	levelDecayedPoints: number
	playerDecayedPoints: number
}

interface UserPointContributionBatchInput {
	idUser: number
	contributions: Omit<UserPointContributionInput, 'idUser'>[]
}

const INSERT_BATCH_SIZE = 500

function normalizedPoints(value: number): number {
	return Math.round(value * 1000)
}

export function userPointContributionFingerprint(
	contributions: Omit<UserPointContributionInput, 'idUser'>[],
): string {
	return contributions
		.map((contribution) =>
			[
				contribution.idLevel,
				contribution.idRecord,
				contribution.contributionRank,
				contribution.levelPosition,
				contribution.levelPoints,
				normalizedPoints(contribution.levelDecayedPoints),
				normalizedPoints(contribution.playerDecayedPoints),
			].join(':'),
		)
		.join('|')
}

function chunks<T>(items: T[], size: number): T[][] {
	const result: T[][] = []
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size))
	}
	return result
}

export async function upsertUserPointContributionsBulk(
	entries: UserPointContributionBatchInput[],
): Promise<void> {
	if (entries.length === 0) {
		return
	}

	const idUsers = [...new Set(entries.map((entry) => entry.idUser))]
	const existingRows = await db
		.select({
			idUser: userPointContribution.idUser,
			idLevel: userPointContribution.idLevel,
			idRecord: userPointContribution.idRecord,
			contributionRank: userPointContribution.contributionRank,
			levelPosition: userPointContribution.levelPosition,
			levelPoints: userPointContribution.levelPoints,
			levelDecayedPoints: userPointContribution.levelDecayedPoints,
			playerDecayedPoints: userPointContribution.playerDecayedPoints,
		})
		.from(userPointContribution)
		.where(inArray(userPointContribution.idUser, idUsers))
		.orderBy(asc(userPointContribution.idUser), asc(userPointContribution.contributionRank))

	const existingByUser = new Map<number, Omit<UserPointContributionInput, 'idUser'>[]>()
	for (const row of existingRows) {
		const rows = existingByUser.get(row.idUser) ?? []
		rows.push({
			idLevel: row.idLevel,
			idRecord: row.idRecord,
			contributionRank: row.contributionRank,
			levelPosition: row.levelPosition,
			levelPoints: row.levelPoints,
			levelDecayedPoints: row.levelDecayedPoints,
			playerDecayedPoints: row.playerDecayedPoints,
		})
		existingByUser.set(row.idUser, rows)
	}

	const changedEntries = entries.filter(
		(entry) =>
			userPointContributionFingerprint(existingByUser.get(entry.idUser) ?? []) !==
			userPointContributionFingerprint(entry.contributions),
	)
	if (changedEntries.length === 0) {
		return
	}

	const changedUserIds = changedEntries.map((entry) => entry.idUser)
	const now = new Date().toISOString()
	const rows = changedEntries.flatMap((entry) =>
		entry.contributions.map((contribution) => ({
			idUser: entry.idUser,
			...contribution,
			dateCalculated: now,
		})),
	)

	await db.transaction(async (tx) => {
		await tx
			.delete(userPointContribution)
			.where(inArray(userPointContribution.idUser, changedUserIds))

		for (const batch of chunks(rows, INSERT_BATCH_SIZE)) {
			await tx.insert(userPointContribution).values(batch)
		}
	})
}

export async function clearUserPointContributions(idUsers: number[]): Promise<void> {
	if (idUsers.length === 0) {
		return
	}
	await db.delete(userPointContribution).where(inArray(userPointContribution.idUser, idUsers))
}

export async function getUserPointContributions(idUser: number) {
	return db
		.select()
		.from(userPointContribution)
		.where(eq(userPointContribution.idUser, idUser))
		.orderBy(asc(userPointContribution.contributionRank))
}
