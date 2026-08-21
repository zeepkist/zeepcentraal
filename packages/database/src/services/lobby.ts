import type { LobbyPacket, WireLobby } from '@zeepkist/core/zeepnet'
import { desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { lobby, lobbyHistory, lobbyStats, user } from '../schema'

type LobbyRow = typeof lobby.$inferSelect
type LobbyChangeType = 'closed' | 'opened' | 'reopened' | 'updated'
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const STATS_LOCK_KEY = 'zeepcentraal:lobby:stats'
const LOBBY_LOCK_KEY = 'zeepcentraal:lobby:rooms'

export async function persistLobbyPacket(packet: LobbyPacket, observedAt: string): Promise<void> {
	if (packet.type === 'statistics') {
		await persistLobbyStatistics(packet, observedAt)
		return
	}

	await db.transaction(async (tx) => {
		await acquirePersistenceLock(tx, LOBBY_LOCK_KEY)
		if (packet.type === 'list') {
			await persistActiveLobbies(tx, packet.lobbies, observedAt, true)
		} else if (packet.operation === 'removed') {
			await closeLobby(tx, packet.lobby, observedAt)
		} else {
			await persistActiveLobbies(tx, [packet.lobby], observedAt, false)
		}
	})
}

async function persistLobbyStatistics(
	packet: Extract<LobbyPacket, { type: 'statistics' }>,
	observedAt: string,
) {
	await db.transaction(async (tx) => {
		await acquirePersistenceLock(tx, STATS_LOCK_KEY)
		const [previous] = await tx
			.select({
				players: lobbyStats.players,
				rooms: lobbyStats.rooms,
				playersInRooms: lobbyStats.playersInRooms,
			})
			.from(lobbyStats)
			.orderBy(desc(lobbyStats.id))
			.limit(1)

		if (
			previous?.players === packet.onlinePlayers &&
			previous.rooms === packet.lobbyCount &&
			previous.playersInRooms === packet.playersInLobbies
		) {
			return
		}

		await tx.insert(lobbyStats).values({
			players: packet.onlinePlayers,
			rooms: packet.lobbyCount,
			playersInRooms: packet.playersInLobbies,
			dateCreated: observedAt,
			dateUpdated: observedAt,
		})
	})
}

async function persistActiveLobbies(
	tx: DatabaseTransaction,
	wireLobbies: WireLobby[],
	observedAt: string,
	authoritative: boolean,
) {
	const currentByMasterId = new Map(wireLobbies.map((entry) => [entry.id, entry]))
	const current = [...currentByMasterId.values()]
	await upsertLobbyHosts(tx, current, observedAt)

	const masterIds = current.map((entry) => entry.id)
	const existing = await selectExistingLobbies(tx, masterIds, authoritative)
	const existingByMasterId = new Map(existing.map((entry) => [entry.masterId, entry]))

	if (current.length > 0) {
		const upserted = await tx
			.insert(lobby)
			.values(
				current.map((entry) => ({
					masterId: entry.id,
					roomName: entry.title,
					hostId: BigInt(entry.host.steamId),
					players: entry.players,
					playerLimit: entry.playerLimit,
					isPublic: entry.isPublic,
					peakPlayers: entry.players,
					peakTime: observedAt,
					firstSeen: observedAt,
					lastSeen: observedAt,
					closedAt: null,
					dateCreated: observedAt,
					dateUpdated: observedAt,
				})),
			)
			.onConflictDoUpdate({
				target: lobby.masterId,
				set: {
					roomName: sql`excluded.room_name`,
					hostId: sql`excluded.host_id`,
					players: sql`excluded.players`,
					playerLimit: sql`excluded.player_limit`,
					isPublic: sql`excluded.is_public`,
					peakPlayers: sql`CASE
						WHEN excluded.players > ${lobby.peakPlayers} THEN excluded.players
						ELSE ${lobby.peakPlayers}
					END`,
					peakTime: sql`CASE
						WHEN excluded.players > ${lobby.peakPlayers} THEN excluded.last_seen
						ELSE ${lobby.peakTime}
					END`,
					lastSeen: observedAt,
					closedAt: null,
					dateUpdated: observedAt,
				},
			})
			.returning({ id: lobby.id, masterId: lobby.masterId })
		const idByMasterId = new Map(upserted.map((entry) => [entry.masterId, entry.id]))
		const history = current.flatMap((entry) => {
			const previous = existingByMasterId.get(entry.id)
			const changeType = getActiveChangeType(previous, entry)
			const lobbyId = idByMasterId.get(entry.id)
			return changeType && lobbyId
				? [toHistoryInsert(lobbyId, entry, changeType, observedAt)]
				: []
		})
		if (history.length > 0) {
			await tx.insert(lobbyHistory).values(history)
		}
	}

	if (!authoritative) {
		return
	}

	const activeMissing = existing.filter(
		(entry) => entry.closedAt === null && !currentByMasterId.has(entry.masterId),
	)
	if (activeMissing.length === 0) {
		return
	}

	await tx
		.update(lobby)
		.set({ closedAt: observedAt, dateUpdated: observedAt })
		.where(
			inArray(
				lobby.id,
				activeMissing.map((entry) => entry.id),
			),
		)
	await tx.insert(lobbyHistory).values(
		activeMissing.map((entry) => ({
			lobbyId: entry.id,
			hostId: entry.hostId,
			changeType: 'closed' as const,
			roomName: entry.roomName,
			players: entry.players,
			playerLimit: entry.playerLimit,
			isPublic: entry.isPublic,
			observedAt,
			dateCreated: observedAt,
		})),
	)
}

async function closeLobby(tx: DatabaseTransaction, entry: WireLobby, observedAt: string) {
	await upsertLobbyHosts(tx, [entry], observedAt)
	const [previous] = await tx.select().from(lobby).where(eq(lobby.masterId, entry.id)).limit(1)
	const hostId = BigInt(entry.host.steamId)

	if (!previous) {
		const [created] = await tx
			.insert(lobby)
			.values({
				masterId: entry.id,
				roomName: entry.title,
				hostId,
				players: entry.players,
				playerLimit: entry.playerLimit,
				isPublic: entry.isPublic,
				peakPlayers: entry.players,
				peakTime: observedAt,
				firstSeen: observedAt,
				lastSeen: observedAt,
				closedAt: observedAt,
				dateCreated: observedAt,
				dateUpdated: observedAt,
			})
			.returning({ id: lobby.id })
		if (created) {
			await tx
				.insert(lobbyHistory)
				.values(toHistoryInsert(created.id, entry, 'closed', observedAt))
		}
		return
	}

	await tx
		.update(lobby)
		.set({
			roomName: entry.title,
			hostId,
			players: entry.players,
			playerLimit: entry.playerLimit,
			isPublic: entry.isPublic,
			peakPlayers:
				entry.players > previous.peakPlayers ? entry.players : previous.peakPlayers,
			peakTime: entry.players > previous.peakPlayers ? observedAt : previous.peakTime,
			lastSeen: observedAt,
			closedAt: observedAt,
			dateUpdated: observedAt,
		})
		.where(eq(lobby.id, previous.id))

	if (previous.closedAt === null) {
		await tx
			.insert(lobbyHistory)
			.values(toHistoryInsert(previous.id, entry, 'closed', observedAt))
	}
}

async function selectExistingLobbies(
	tx: DatabaseTransaction,
	masterIds: string[],
	authoritative: boolean,
) {
	if (authoritative) {
		return masterIds.length > 0
			? tx
					.select()
					.from(lobby)
					.where(or(inArray(lobby.masterId, masterIds), isNull(lobby.closedAt)))
			: tx.select().from(lobby).where(isNull(lobby.closedAt))
	}
	return masterIds.length > 0
		? tx.select().from(lobby).where(inArray(lobby.masterId, masterIds))
		: []
}

async function upsertLobbyHosts(tx: DatabaseTransaction, entries: WireLobby[], observedAt: string) {
	const hosts = new Map(
		entries.map((entry) => [entry.host.steamId, entry.host.name.slice(0, 255)]),
	)
	if (hosts.size === 0) {
		return
	}
	await tx
		.insert(user)
		.values(
			[...hosts].map(([steamId, steamName]) => ({
				steamId: BigInt(steamId),
				steamName,
				banned: false,
				dateCreated: observedAt,
				dateUpdated: observedAt,
			})),
		)
		.onConflictDoUpdate({
			target: user.steamId,
			set: { steamName: sql`excluded.steam_name`, dateUpdated: observedAt },
			setWhere: sql`${user.steamName} IS DISTINCT FROM excluded.steam_name`,
		})
}

async function acquirePersistenceLock(tx: DatabaseTransaction, lockKey: string) {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`)
}

function getActiveChangeType(
	previous: LobbyRow | undefined,
	entry: WireLobby,
): LobbyChangeType | undefined {
	if (!previous) {
		return 'opened'
	}
	if (previous.closedAt !== null) {
		return 'reopened'
	}
	return hasMaterialChange(previous, entry) ? 'updated' : undefined
}

function hasMaterialChange(previous: LobbyRow, entry: WireLobby) {
	return (
		previous.roomName !== entry.title ||
		previous.hostId !== BigInt(entry.host.steamId) ||
		previous.players !== entry.players ||
		previous.playerLimit !== entry.playerLimit ||
		previous.isPublic !== entry.isPublic
	)
}

function toHistoryInsert(
	lobbyId: bigint,
	entry: WireLobby,
	changeType: LobbyChangeType,
	observedAt: string,
) {
	return {
		lobbyId,
		hostId: BigInt(entry.host.steamId),
		changeType,
		roomName: entry.title,
		players: entry.players,
		playerLimit: entry.playerLimit,
		isPublic: entry.isPublic,
		observedAt,
		dateCreated: observedAt,
	}
}
