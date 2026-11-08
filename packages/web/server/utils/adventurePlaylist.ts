import type { Zc_AdventurePlayerLevelFragment } from '@zeepkist/graphql/generated'
import {
	groupAdventurePlayerLevels,
	mapAdventurePlayerLevels,
} from '../../app/utils/adventurePlayerLevels'
import { findAdventureSeries } from '../../app/utils/adventureSeries'
import {
	createLocalPlaylist,
	parseSafeWorkshopId,
	serializePlaylist,
} from '../../app/utils/playlist'
import { collectTournamentPlaylistPages } from './tournamentPlaylist'

export class AdventurePlaylistError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
	}
}

export function parseAdventurePlaylistQuery(query: Record<string, unknown>) {
	const series = query.series
	if (series !== undefined && (typeof series !== 'string' || !findAdventureSeries(series)))
		throw new AdventurePlaylistError(400, 'Invalid Adventure series')
	if (query.missing !== undefined && query.missing !== 'true' && query.missing !== 'false')
		throw new AdventurePlaylistError(400, 'Invalid missing-level filter')
	return { series: series as string | undefined, missing: query.missing === 'true' }
}

export async function collectAdventurePlaylist(
	fetchPage: Parameters<
		typeof collectTournamentPlaylistPages<Zc_AdventurePlayerLevelFragment>
	>[0],
	series?: string,
	missing = false,
) {
	const memberships = await collectTournamentPlaylistPages(fetchPage)
	if (memberships.some((membership) => !membership.level))
		throw new AdventurePlaylistError(422, 'Adventure level mapping unavailable')
	const levels = groupAdventurePlayerLevels(mapAdventurePlayerLevels(memberships), 'level')
		.flatMap((group) => group.levels)
		.filter((level) => !missing || !level.pb)
	if (!levels.length) throw new AdventurePlaylistError(404, 'Adventure playlist has no levels')
	const name = `ZeepCentraal ${series ? `Adventure Series ${findAdventureSeries(series)?.key}` : 'Adventure'}${missing ? ' - Missing levels' : ''}`
	const playlist = createLocalPlaylist([], name)
	playlist.levels = levels.map((level) => {
		const item = level.item
		const workshopId = parseSafeWorkshopId(item?.workshopId)
		if (!item?.fileUid || workshopId === null)
			throw new AdventurePlaylistError(
				422,
				'Adventure level has no downloadable file mapping',
			)
		return {
			UID: item.fileUid,
			WorkshopID: workshopId,
			Name: item.name,
			Author: item.fileAuthor,
		}
	})
	return {
		filename: `zeepcentraal-adventure-${series ?? 'all'}${missing ? '-missing' : ''}.zeeplist`,
		body: serializePlaylist(playlist),
	}
}
