import {
	Zc_SitemapLevelsPageDocument,
	Zc_SitemapMaxIdsDocument,
	Zc_SitemapRecordsPageDocument,
	Zc_SitemapSuperLeagueLevelsPageDocument,
	Zc_SitemapSuperLeagueRoundsPageDocument,
	Zc_SitemapSuperLeagueSeasonsPageDocument,
	Zc_SitemapTrackTournamentsPageDocument,
	Zc_SitemapUsersPageDocument,
} from '@zeepkist/graphql/generated'
import type { H3Event } from 'h3'
import {
	superLeagueLevelPath,
	superLeagueRoundPath,
	superLeagueSeasonPath,
} from '../../app/utils/superLeagueRoutes'
import { tournamentPath } from '../../app/utils/tournament'
import { fetchGraphql } from './graphql'
import type { SitemapEntry, SitemapGroup, SitemapMaxIds } from './sitemap-pure'
import { sitemapPageRange } from './sitemap-pure'

const cachedSitemapMaxIds = defineCachedFunction(
	async (_event: H3Event): Promise<SitemapMaxIds> => {
		const now = new Date().toISOString()
		const data = await fetchGraphql(Zc_SitemapMaxIdsDocument, { now })
		return {
			users: data.users?.aggregates?.max?.id ?? 0,
			levels: data.levels?.aggregates?.max?.id ?? 0,
			records: data.records?.aggregates?.max?.id ?? 0,
			tournaments: data.trackTournaments?.aggregates?.max?.id ?? 0,
			'super-league-seasons': data.zslSeasons?.aggregates?.max?.id ?? 0,
			'super-league-rounds': data.zslRounds?.aggregates?.max?.id ?? 0,
			'super-league-levels': data.zslLevels?.aggregates?.max?.id ?? 0,
		}
	},
	{
		name: 'sitemap-max-ids',
		maxAge: 600,
		swr: true,
		getKey: () => 'all',
	},
)

export function getSitemapMaxIds(event: H3Event): Promise<SitemapMaxIds> {
	return cachedSitemapMaxIds(event)
}

export function resolveSitemapUrl(event: H3Event, path: string): string {
	const siteUrl = getSiteConfig(event).url || getRequestURL(event).origin
	return new URL(path, siteUrl).toString()
}

export async function fetchSitemapPage(group: SitemapGroup, page: number): Promise<SitemapEntry[]> {
	const range = sitemapPageRange(page)
	switch (group) {
		case 'users': {
			const data = await fetchGraphql(Zc_SitemapUsersPageDocument, range)
			return (
				data.users?.nodes.map((user) => ({
					loc: `/user/${String(user.steamId)}`,
					lastmod: String(user.dateUpdated ?? user.dateCreated),
				})) ?? []
			)
		}
		case 'levels': {
			const data = await fetchGraphql(Zc_SitemapLevelsPageDocument, range)
			return (
				data.levels?.nodes.map((level) => ({
					loc: `/level/${level.xxHash}`,
					lastmod: String(level.dateUpdated ?? level.dateCreated),
				})) ?? []
			)
		}
		case 'records': {
			const data = await fetchGraphql(Zc_SitemapRecordsPageDocument, range)
			return (
				data.records?.nodes.map((record) => ({
					loc: `/record/${record.id}`,
					lastmod: String(record.dateUpdated ?? record.dateCreated),
				})) ?? []
			)
		}
		case 'tournaments': {
			const data = await fetchGraphql(Zc_SitemapTrackTournamentsPageDocument, {
				...range,
				now: new Date().toISOString(),
			})
			return (
				data.trackTournaments?.nodes.flatMap((tournament) => {
					if (tournament.type !== 0 && tournament.type !== 1) return []
					return [
						{
							loc: tournamentPath(tournament.type, tournament.slug),
							lastmod: String(tournament.dateUpdated ?? tournament.dateCreated),
						},
					]
				}) ?? []
			)
		}
		case 'super-league-seasons': {
			const data = await fetchGraphql(Zc_SitemapSuperLeagueSeasonsPageDocument, range)
			return (
				data.zslSeasons?.nodes.map((season) => ({
					loc: superLeagueSeasonPath(season.id),
					lastmod: String(season.dateUpdated ?? season.dateCreated),
				})) ?? []
			)
		}
		case 'super-league-rounds': {
			const data = await fetchGraphql(Zc_SitemapSuperLeagueRoundsPageDocument, range)
			return (
				data.zslRounds?.nodes.flatMap((round) => {
					if (!round.season) return []
					return [
						{
							loc: superLeagueRoundPath(round.season.id, round.round),
							lastmod: String(round.dateUpdated ?? round.dateCreated),
						},
					]
				}) ?? []
			)
		}
		case 'super-league-levels': {
			const data = await fetchGraphql(Zc_SitemapSuperLeagueLevelsPageDocument, range)
			return (
				data.zslLevels?.nodes.flatMap((level) => {
					if (!level.round?.season) return []
					return [
						{
							loc: superLeagueLevelPath(
								level.round.season.id,
								level.round.round,
								level.id,
							),
							lastmod: String(level.dateUpdated ?? level.dateCreated),
						},
					]
				}) ?? []
			)
		}
	}
}
