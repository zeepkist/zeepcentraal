import type { TrackTournamentFilter } from '@zeepkist/graphql/generated'
import { Zc_TrackTournamentPlaylistDocument } from '@zeepkist/graphql/generated'
import {
	buildTournamentPlaylist,
	type TournamentPlaylistLevelSource,
} from '../../../app/utils/tournamentPlaylist'
import { fetchGraphql } from '../../utils/graphql'
import type { TournamentPlaylistRequest } from '../../utils/tournamentPlaylist'
import {
	collectTournamentPlaylistPages,
	parseTournamentPlaylistQuery,
	tournamentPlaylistIdentity,
} from '../../utils/tournamentPlaylist'

export default defineEventHandler(async (event) => {
	let request: TournamentPlaylistRequest
	try {
		request = parseTournamentPlaylistQuery(getQuery(event))
	} catch (error) {
		throw createError({
			statusCode: 400,
			statusMessage:
				error instanceof Error ? error.message : 'Invalid tournament playlist query',
		})
	}

	const filter: TrackTournamentFilter = {
		startAt: { lessThanOrEqualTo: new Date().toISOString() },
		...(request.type === undefined ? {} : { type: { equalTo: request.type } }),
		...(request.slug === undefined ? {} : { slug: { equalTo: request.slug } }),
	}
	const tournaments = await collectTournamentPlaylistPages(async (after) => {
		const data = await fetchGraphql(Zc_TrackTournamentPlaylistDocument, {
			first: 1000,
			after,
			filter,
		})
		return (
			data.trackTournaments ?? {
				nodes: [],
				pageInfo: { endCursor: null, hasNextPage: false },
			}
		)
	})
	const levels = tournaments.flatMap<TournamentPlaylistLevelSource>((tournament) => {
		const item = tournament.level?.levelItems.nodes[0]
		if (!item) return []
		return [
			{
				fileUid: item.fileUid,
				workshopId: String(item.workshopId),
				name: item.name,
				author: item.fileAuthor,
				validationTimeAuthor: item.validationTimeAuthor,
				worldRecordTime: tournament.level?.worldRecordGlobal?.record?.time ?? null,
			},
		]
	})
	if (levels.length === 0) {
		throw createError({ statusCode: 404, statusMessage: 'Tournament playlist has no levels' })
	}

	const identity = tournamentPlaylistIdentity(request)
	const playlist = buildTournamentPlaylist(
		identity.name,
		levels,
		request.slug === undefined ? 'aggregate' : 'single',
	)
	setResponseHeaders(event, {
		'cache-control': 'no-store',
		'content-disposition': `attachment; filename="${identity.filename}"`,
		'content-type': 'application/json; charset=utf-8',
		'x-content-type-options': 'nosniff',
	})
	return `${JSON.stringify(playlist, null, 2)}\n`
})
