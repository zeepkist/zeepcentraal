import type { Zc_GhostComparisonRecordFragment } from '~/graphql/generated/graphql'
import type { GhostRecordSource } from '~/types/ghost'

export function mapGhostRecordSource(record: Zc_GhostComparisonRecordFragment): GhostRecordSource {
	const mediaRevision = record.recordMedia?.dateUpdated ?? record.recordMedia?.dateCreated

	return {
		recordId: record.id,
		levelId: record.levelId,
		userId: record.userId,
		userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
		userName: record.user?.steamName ?? null,
		time: record.time,
		dateCreated: String(record.dateCreated),
		ghostUrl: record.recordMedia?.ghostUrl ?? null,
		mediaRevision: mediaRevision == null ? null : String(mediaRevision),
		isWorldRecord: record.worldRecordGlobals.totalCount > 0,
		isPersonalBest: record.personalBestGlobals.totalCount > 0,
		splits: record.splits,
		speeds: record.speeds,
	}
}
