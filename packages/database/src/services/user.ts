import { desc, eq, sql } from 'drizzle-orm';
import { getSteamUser } from '@zeepkist/core';
import { db } from '../index';
import { record, user } from '../schema';

export async function getUserBySteamId(steamId: bigint) {
	return db.query.user.findFirst({
		where: eq(user.steamId, steamId),
	});
}

export async function getUser(steamId: string) {
	return getUserBySteamId(BigInt(steamId));
}

export async function getUserByDiscordId(discordId: string) {
	return db.query.user.findFirst({
		where: eq(user.discordId, BigInt(discordId)),
	});
}

export async function getOrInsertUser(steamId: bigint, steamName?: string) {
	const resolvedSteamName = steamName ?? (await getSteamUser(steamId.toString())).personaname;
	const existing = await getUserBySteamId(steamId);
	if (existing) {
		return existing;
	}

	const [created] = await db
		.insert(user)
		.values({ steamId, steamName: resolvedSteamName, banned: false })
		.returning();

	return created;
}

export async function updateUserName(steamId: string, newName: string) {
	const [updated] = await db
		.update(user)
		.set({ steamName: newName, dateUpdated: new Date().toISOString() })
		.where(eq(user.steamId, BigInt(steamId)))
		.returning();

	return updated;
}

export async function updateDiscordId(steamId: string, discordId: bigint | null) {
	const [updated] = await db
		.update(user)
		.set({ discordId, dateUpdated: new Date().toISOString() })
		.where(eq(user.steamId, BigInt(steamId)))
		.returning();

	return updated;
}

export interface UserWithLatestRecordDate {
	idUser: number;
	latestRecordDate: string | null;
}

export async function getAllUsersWithLatestRecordDate(): Promise<UserWithLatestRecordDate[]> {
	const users = await db
		.select({
			idUser: user.id,
			latestRecordDate: sql<string | null>`MAX(${record.dateCreated})`.as('latest_record_date'),
		})
		.from(user)
		.leftJoin(record, eq(user.id, record.idUser))
		.groupBy(user.id)
		.orderBy(desc(sql`MAX(${record.dateCreated})`));

	return users;
}
