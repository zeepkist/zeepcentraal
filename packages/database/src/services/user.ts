import { databaseConfig } from '@zeepkist/core/config/database'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { record, user } from '../schema'
import { resolveBulkSteamNames } from './userSteamNames'

interface SteamUserData {
	steamid: string
	personaname: string
}
async function getSteamUser(steamId: string): Promise<SteamUserData> {
	const player = await getSteamUserOrUndefined(steamId)
	if (!player) {
		throw new Error('Steam user not found.')
	}
	return player
}

async function getSteamUserOrUndefined(steamId: string): Promise<SteamUserData | undefined> {
	const apiKey = databaseConfig.steam.apiKey
	if (!apiKey) {
		throw new Error('Steam API key is not configured.')
	}
	const response = await fetch(
		`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`,
	)
	if (!response.ok) {
		throw new Error('Steam user request failed.')
	}
	const data = (await response.json()) as { response?: { players?: SteamUserData[] } }
	return data.response?.players?.[0]
}

export async function getUserBySteamId(steamId: bigint) {
	return db.query.user.findFirst({
		where: eq(user.steamId, steamId),
	})
}

export async function getUser(steamId: string) {
	return getUserBySteamId(BigInt(steamId))
}

export async function getUserByDiscordId(discordId: string) {
	const parsedDiscordId = BigInt(discordId)
	if (parsedDiscordId <= 0n) {
		return undefined
	}
	return db.query.user.findFirst({
		where: and(eq(user.discordId, parsedDiscordId), gt(user.discordId, 0n)),
	})
}

export async function getOrInsertUser(steamId: bigint, steamName?: string) {
	const resolvedSteamName = steamName ?? (await getSteamUser(steamId.toString())).personaname
	const now = new Date().toISOString()

	const [upserted] = await db
		.insert(user)
		.values({
			steamId,
			steamName: resolvedSteamName,
			banned: false,
			dateCreated: now,
			dateUpdated: now,
		})
		.onConflictDoUpdate({
			target: user.steamId,
			set: {
				steamName: resolvedSteamName,
				dateUpdated: now,
			},
		})
		.returning()

	return upserted ?? getUserBySteamId(steamId)
}

export async function resolveSteamNameForWorkshopAuthor(steamId: bigint): Promise<string> {
	const existing = await getUserBySteamId(steamId)
	if (existing?.steamName && existing.steamName !== 'Unknown') {
		return existing.steamName
	}

	try {
		return (await getSteamUserOrUndefined(steamId.toString()))?.personaname ?? 'Unknown'
	} catch {
		return 'Unknown'
	}
}

export async function getOrInsertUsersBulk(steamIds: string[]): Promise<Map<string, number>> {
	const uniqueSteamIds = [...new Set(steamIds)]
	if (uniqueSteamIds.length === 0) {
		return new Map<string, number>()
	}

	const existingUsers = await db
		.select({ id: user.id, steamId: user.steamId, steamName: user.steamName })
		.from(user)
		.where(
			inArray(
				user.steamId,
				uniqueSteamIds.map((value) => BigInt(value)),
			),
		)
	const steamNames = await resolveBulkSteamNames(
		uniqueSteamIds,
		existingUsers.flatMap((entry) =>
			entry.steamId === null
				? []
				: [{ steamId: entry.steamId.toString(), steamName: entry.steamName }],
		),
		getSteamUserOrUndefined,
	)
	const now = new Date().toISOString()
	const upsertedUsers = await db
		.insert(user)
		.values(
			uniqueSteamIds.map((steamId) => ({
				steamId: BigInt(steamId),
				steamName: steamNames.get(steamId) ?? 'Unknown',
				discordId: -1n,
				banned: false,
				dateCreated: now,
				dateUpdated: now,
			})),
		)
		.onConflictDoUpdate({
			target: user.steamId,
			set: {
				steamName: sql`excluded.steam_name`,
				dateUpdated: now,
			},
		})
		.returning({ id: user.id, steamId: user.steamId })

	const idMap = new Map<string, number>()
	for (const entry of upsertedUsers) {
		if (entry.steamId !== null) {
			idMap.set(entry.steamId.toString(), entry.id)
		}
	}

	const unresolvedSteamIds = uniqueSteamIds.filter((steamId) => !idMap.has(steamId))
	if (unresolvedSteamIds.length > 0) {
		const resolvedUsers = await db
			.select({ id: user.id, steamId: user.steamId })
			.from(user)
			.where(
				inArray(
					user.steamId,
					unresolvedSteamIds.map((value) => BigInt(value)),
				),
			)

		for (const resolvedUser of resolvedUsers) {
			if (resolvedUser.steamId !== null) {
				idMap.set(resolvedUser.steamId.toString(), resolvedUser.id)
			}
		}
	}

	return idMap
}

export async function updateUserName(steamId: string, newName: string) {
	const [updated] = await db
		.update(user)
		.set({ steamName: newName, dateUpdated: new Date().toISOString() })
		.where(eq(user.steamId, BigInt(steamId)))
		.returning()

	return updated
}

export async function updateDiscordId(steamId: string, discordId: bigint | null) {
	const [updated] = await db
		.update(user)
		.set({ discordId, dateUpdated: new Date().toISOString() })
		.where(eq(user.steamId, BigInt(steamId)))
		.returning()
	return updated
}

export interface UserWithLatestRecordDate {
	idUser: number
	latestRecordDate: string | null
}

export async function getAllUsersWithLatestRecordDate(): Promise<UserWithLatestRecordDate[]> {
	const users = await db
		.select({
			idUser: user.id,
			latestRecordDate: sql<string | null>`MAX(${record.dateCreated})`.as(
				'latest_record_date',
			),
		})
		.from(user)
		.leftJoin(record, eq(user.id, record.idUser))
		.groupBy(user.id)
		.orderBy(desc(sql`MAX(${record.dateCreated})`))

	return users
}
