import { and, desc, eq, lte, sql } from 'drizzle-orm'
import { db } from '../client'
import { downloadFile, uploadFile } from '../s3'
import {
	level,
	levelItem,
	managedLobby,
	trackTournament,
	trackTournamentLobbyAsset,
} from '../schema'
import { TRACK_TOURNAMENT_TYPE } from './trackTournamentHelpers'

export interface TrackTournamentLobbyAssetMetadata {
	author: string
	byteSize: number
	collaborators: string
	contentSha256: string
	fileUid: string
	idTournament: number
	levelName: string
	objectKey: string
	overrideAuthorName: string
	workshopId: bigint
}

export async function getTrackTournamentLobbyAssetSources(idTournament: number) {
	return db
		.select({
			fileAuthor: levelItem.fileAuthor,
			fileUid: levelItem.fileUid,
			format: sql<number>`(
				SELECT metadata.format
				FROM public.level_metadata AS metadata
				WHERE metadata.id_level = ${levelItem.idLevel}
				ORDER BY metadata.id
				LIMIT 1
			)`,
			levelName: levelItem.name,
			workshopId: levelItem.workshopId,
		})
		.from(trackTournament)
		.innerJoin(
			level,
			and(eq(level.id, trackTournament.idLevel), eq(level.publiclyVisible, true)),
		)
		.innerJoin(
			levelItem,
			and(
				eq(levelItem.idLevel, trackTournament.idLevel),
				eq(levelItem.deleted, false),
				eq(levelItem.publiclyVisible, true),
			),
		)
		.where(
			and(
				eq(trackTournament.id, idTournament),
				eq(trackTournament.type, TRACK_TOURNAMENT_TYPE.weekly),
			),
		)
		.orderBy(desc(levelItem.updatedAt), desc(levelItem.id))
}

export async function publishTrackTournamentLobbyAsset(
	metadata: TrackTournamentLobbyAssetMetadata,
	payload: Buffer,
) {
	await uploadFile(metadata.objectKey, payload, 'application/gzip')
	const now = new Date().toISOString()
	await db
		.insert(trackTournamentLobbyAsset)
		.values({ ...metadata, dateCreated: now, dateUpdated: now })
		.onConflictDoUpdate({
			target: trackTournamentLobbyAsset.idTournament,
			set: {
				workshopId: metadata.workshopId,
				fileUid: metadata.fileUid,
				levelName: metadata.levelName,
				author: metadata.author,
				collaborators: metadata.collaborators,
				overrideAuthorName: metadata.overrideAuthorName,
				objectKey: metadata.objectKey,
				contentSha256: metadata.contentSha256,
				byteSize: metadata.byteSize,
				dateUpdated: now,
			},
		})
}

export async function getPreferredTrackTournamentLobbyAsset(at = new Date()) {
	const now = at.toISOString()
	const rows = await db
		.select({
			asset: trackTournamentLobbyAsset,
			active: sql<boolean>`${trackTournament.startAt} <= ${now} AND ${trackTournament.endAt} > ${now}`,
		})
		.from(trackTournamentLobbyAsset)
		.innerJoin(trackTournament, eq(trackTournament.id, trackTournamentLobbyAsset.idTournament))
		.where(
			and(
				eq(trackTournament.type, TRACK_TOURNAMENT_TYPE.weekly),
				lte(trackTournament.startAt, now),
			),
		)
		.orderBy(desc(trackTournament.startAt))
		.limit(2)
	return rows.find((row) => row.active)?.asset ?? rows[0]?.asset
}

export async function downloadTrackTournamentLobbyAsset(objectKey: string) {
	return downloadFile(objectKey)
}

export async function getManagedLobbyJoinId(key: string) {
	const [row] = await db
		.select({ joinId: managedLobby.joinId })
		.from(managedLobby)
		.where(eq(managedLobby.key, key))
		.limit(1)
	return row?.joinId
}

export async function setManagedLobbyJoinId(key: string, joinId: string) {
	const now = new Date().toISOString()
	await db
		.insert(managedLobby)
		.values({ key, joinId, dateCreated: now, dateUpdated: now })
		.onConflictDoUpdate({
			target: managedLobby.key,
			set: { joinId, dateUpdated: now },
		})
}

export async function clearManagedLobbyJoinId(key: string) {
	await db.delete(managedLobby).where(eq(managedLobby.key, key))
}
