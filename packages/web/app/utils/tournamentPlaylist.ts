import type { TrackTournamentType } from '~/types/tournament'

export const TOURNAMENT_PLAYLIST_MINIMUM_ROUND_LENGTH = 12 * 60

export type TournamentPlaylistLevelSource = {
	fileUid: string
	workshopId: string
	name: string
	author: string
	validationTimeAuthor: number
	worldRecordTime: number | null
}

export type ZeepkistPlaylist = {
	name: string
	amountOfLevels: number
	roundLength: number
	shufflePlaylist: boolean
	UID: string[]
	levels: Array<{
		UID: string
		WorkshopID: string
		Name: string
		Author: string
	}>
}

function positiveTime(value: number | null): number | null {
	return value !== null && Number.isFinite(value) && value > 0 ? value : null
}

export function buildTournamentPlaylist(
	name: string,
	levels: TournamentPlaylistLevelSource[],
	mode: 'single' | 'aggregate',
): ZeepkistPlaylist {
	const first = levels[0]
	const trackTime = first
		? (positiveTime(first.worldRecordTime) ?? positiveTime(first.validationTimeAuthor))
		: null
	const roundLength =
		mode === 'aggregate'
			? TOURNAMENT_PLAYLIST_MINIMUM_ROUND_LENGTH
			: Math.max(
					TOURNAMENT_PLAYLIST_MINIMUM_ROUND_LENGTH,
					Math.round((trackTime ?? 0) * 3 * 1000) / 1000,
				)

	return {
		name,
		amountOfLevels: levels.length,
		roundLength,
		shufflePlaylist: mode === 'aggregate',
		UID: [],
		levels: levels.map((level) => ({
			UID: level.fileUid,
			WorkshopID: level.workshopId,
			Name: level.name,
			Author: level.author,
		})),
	}
}

export function tournamentPlaylistPath(type?: TrackTournamentType, slug?: string): string {
	const parameters = new URLSearchParams()
	if (type !== undefined) parameters.set('type', String(type))
	if (slug !== undefined) parameters.set('slug', slug)
	const query = parameters.toString()
	return `/api/tournaments/playlist${query ? `?${query}` : ''}`
}
