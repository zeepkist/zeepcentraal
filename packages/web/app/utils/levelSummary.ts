import type { Zc_LevelExplorerCardFragment } from '@zeepkist/graphql/generated'
import type { LevelSummary } from '~/types/app'
import { getLevelDisplayName } from './levelDisplay'

export function mapLevelSummary(node: Zc_LevelExplorerCardFragment): LevelSummary {
	const item = node.levelItems.nodes[0]
	return {
		id: node.id,
		xxHash: node.xxHash,
		favourited: (node.viewerFavourites?.totalCount ?? 0) > 0,
		fileUid: item?.fileUid,
		fileAuthor: item?.fileAuthor,
		name: getLevelDisplayName(item?.name, node.xxHash),
		imageUrl: item?.imageUrl,
		authorName: item?.author?.steamName,
		authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
		workshopId: item?.workshopId == null ? null : String(item.workshopId),
		adventure: node.adventure,
		dateCreated: String(node.dateCreated),
		points: node.levelPoints?.points,
		rating: node.levelPoints?.rating,
		recordCount: node.records.totalCount,
		personalBestCount: node.personalBestGlobals.totalCount,
		voteCount: node.votes.totalCount,
		worldRecordTime: node.worldRecordGlobal?.record?.time,
		worldRecordAuthorName: node.worldRecordGlobal?.user?.steamName,
		worldRecordAuthorSteamId:
			node.worldRecordGlobal?.user?.steamId == null
				? null
				: String(node.worldRecordGlobal.user.steamId),
		medals: item
			? {
					author: item.validationTimeAuthor,
					gold: item.validationTimeGold,
					silver: item.validationTimeSilver,
					bronze: item.validationTimeBronze,
				}
			: null,
	}
}
