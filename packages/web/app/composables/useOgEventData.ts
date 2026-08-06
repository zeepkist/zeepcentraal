import { useQuery } from '@urql/vue'
import type { Zc_TrackTournamentSummaryFragment } from '@zeepkist/graphql/generated'
import {
	Zc_TrackTournamentDetailDocument,
	Zc_TrackTournamentIndexDocument,
	Zc_ZslLevelDocument,
	Zc_ZslLevelResultsDocument,
	Zc_ZslRoundBySeasonAndNumberDocument,
	Zc_ZslRoundResultsDocument,
	Zc_ZslSeasonDocument,
	Zc_ZslSeasonResultsDocument,
	Zc_ZslSeasonsDocument,
} from '@zeepkist/graphql/generated'
import { computed } from 'vue'
import type { TrackTournamentType } from '~/types/tournament'
import { getOgTournamentStatus } from '~/utils/ogImage'
import { formatTournamentPeriod } from '~/utils/tournament'

export interface OgEventPlayer {
	name: string
	points: string
	rank: number
}

interface StandingNode {
	points: number
	position?: number
	rank?: number
	user?: {
		steamId?: unknown
		steamName?: string | null
	} | null
}

const numberFormatter = new Intl.NumberFormat('en-GB')
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC',
})

export function formatOgEventNumber(value: number): string {
	return numberFormatter.format(value)
}

export function formatOgEventDate(value: unknown): string {
	const date = new Date(String(value))
	return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date)
}

export function formatOgTournamentPeriod(type: TrackTournamentType, slug: string): string {
	return formatTournamentPeriod(type, slug, 'en-GB', ({ year, week }) => `${year} Week ${week}`)
}

function mapPlayers(nodes: readonly StandingNode[]): OgEventPlayer[] {
	return nodes.slice(0, 3).map((node, index) => ({
		name:
			node.user?.steamName?.trim() ||
			(node.user?.steamId == null ? 'Unknown player' : String(node.user.steamId)),
		points: formatOgEventNumber(node.points),
		rank: node.position ?? node.rank ?? index + 1,
	}))
}

function parseCompositeSlug(slug: string, prefixes: readonly string[]): Array<number> | null {
	const parts = slug.split('/')
	if (parts.length !== prefixes.length) return null
	const values = parts.map((part, index) => parseSuperLeagueSlug(part, prefixes[index] ?? ''))
	return values.every((value): value is number => value !== null) ? values : null
}

function validTournamentSlug(type: TrackTournamentType, slug: string): boolean {
	return type === 0 ? /^\d{4}-w\d{2}$/.test(slug) : /^\d{4}-\d{2}$/.test(slug)
}

function mapTournament(node: Zc_TrackTournamentSummaryFragment | null | undefined) {
	const level = node?.level
	if (!node || !level) return null
	const item = level.levelItems.nodes[0]
	return {
		slug: node.slug,
		startAt: String(node.startAt),
		endAt: String(node.endAt),
		levelName: item?.name ?? level.xxHash,
		authorName: item?.author?.steamName ?? null,
		imageUrl: item?.imageUrl ?? null,
		levelPoints: level.levelPoints?.points ?? null,
		competitorCount: node.trackTournamentResults.totalCount,
		players: mapPlayers(node.trackTournamentResults.nodes),
	}
}

export function useOgSuperLeagueData() {
	const result = useQuery({
		query: Zc_ZslSeasonsDocument,
		variables: { first: 3 },
	})
	const data = computed(() => {
		const connection = result.data.value?.zslSeasons
		return {
			seasons:
				connection?.edges.map(({ node }) => ({
					id: node.id,
					name: node.name,
					dates: `${formatOgEventDate(node.startDate)} – ${formatOgEventDate(node.endDate)}`,
					roundCount: node.zslRounds.nodes.length,
					competitorCount: node.zslSeasonResults.totalCount,
				})) ?? [],
		}
	})
	async function prefetch() {
		if (import.meta.server) await result
	}
	return { data, prefetch, result }
}

export function useOgSuperLeagueSeasonData(slug: string) {
	const id = parseSuperLeagueSlug(slug, 'season')
	const paused = id === null
	const result = useQuery({
		query: Zc_ZslSeasonDocument,
		variables: { id: id ?? 0 },
		pause: paused,
	})
	const standingsResult = useQuery({
		query: Zc_ZslSeasonResultsDocument,
		variables: {
			id: id ?? 0,
			viewerId: 0,
			includeViewer: false,
			first: 3,
		},
		pause: paused,
	})
	const data = computed(() => ({
		seasonName: result.data.value?.zslSeason?.name ?? (id ? `Season ${id}` : 'Super League'),
		competitorCount: standingsResult.data.value?.zslSeasonResults?.totalCount ?? 0,
		players: mapPlayers(
			standingsResult.data.value?.zslSeasonResults?.edges.map(({ node }) => node) ?? [],
		),
	}))
	async function prefetch() {
		if (import.meta.server && !paused) await Promise.all([result, standingsResult])
	}
	return { data, prefetch, result, standingsResult }
}

export function useOgSuperLeagueRoundData(slug: string) {
	const parsed = parseCompositeSlug(slug, ['season', 'round'])
	const seasonId = parsed?.[0] ?? 0
	const roundNumber = parsed?.[1] ?? 0
	const paused = parsed === null
	const result = useQuery({
		query: Zc_ZslRoundBySeasonAndNumberDocument,
		variables: { seasonId, round: roundNumber },
		pause: paused,
	})
	const standingsResult = useQuery({
		query: Zc_ZslRoundResultsDocument,
		variables: {
			seasonId,
			round: roundNumber,
			viewerId: 0,
			includeViewer: false,
			first: 3,
		},
		pause: paused,
	})
	const data = computed(() => {
		const round = result.data.value?.zslRounds?.nodes[0]
		return {
			seasonName: round?.season?.name ?? (seasonId ? `Season ${seasonId}` : 'Super League'),
			roundName: round?.name ?? 'Round standings',
			roundNumber,
			competitorCount: standingsResult.data.value?.zslRoundResults?.totalCount ?? 0,
			players: mapPlayers(
				standingsResult.data.value?.zslRoundResults?.edges.map(({ node }) => node) ?? [],
			),
		}
	})
	async function prefetch() {
		if (import.meta.server && !paused) await Promise.all([result, standingsResult])
	}
	return { data, prefetch, result, standingsResult }
}

export function useOgSuperLeagueLevelData(slug: string) {
	const parsed = parseCompositeSlug(slug, ['season', 'round', 'level'])
	const seasonId = parsed?.[0] ?? 0
	const roundNumber = parsed?.[1] ?? 0
	const levelId = parsed?.[2] ?? 0
	const paused = parsed === null
	const result = useQuery({
		query: Zc_ZslLevelDocument,
		variables: { id: levelId },
		pause: paused,
	})
	const standingsResult = useQuery({
		query: Zc_ZslLevelResultsDocument,
		variables: {
			id: levelId,
			viewerId: 0,
			includeViewer: false,
			first: 3,
		},
		pause: paused,
	})
	const data = computed(() => {
		const candidate = result.data.value?.zslLevel
		const level =
			candidate?.round?.seasonId === seasonId && candidate.round.round === roundNumber
				? candidate
				: null
		const item = level?.level?.levelItems.nodes[0]
		return {
			seasonName:
				level?.round?.season?.name ?? (seasonId ? `Season ${seasonId}` : 'Super League'),
			roundName: level?.round?.name ?? 'Round',
			roundNumber,
			levelName: item?.name ?? 'Level standings',
			imageUrl: item?.imageUrl ?? null,
			fastestTime: level?.zslLevelResults.aggregates?.min?.time ?? null,
			competitorCount: level
				? (standingsResult.data.value?.zslLevelResults?.totalCount ?? 0)
				: 0,
			players: level
				? mapPlayers(
						standingsResult.data.value?.zslLevelResults?.edges.map(
							({ node }) => node,
						) ?? [],
					)
				: [],
		}
	})
	async function prefetch() {
		if (import.meta.server && !paused) await Promise.all([result, standingsResult])
	}
	return { data, prefetch, result, standingsResult }
}

function trackTournamentLabel(type: TrackTournamentType): string {
	return type === 0 ? 'Track of the Week' : 'Track of the Month'
}

function trackTournamentView(
	type: TrackTournamentType,
	tournament: ReturnType<typeof mapTournament>,
	now: Date,
) {
	const label = trackTournamentLabel(type)
	if (!tournament) {
		return {
			description:
				type === 0 ? 'Weekly community competition' : 'Monthly community competition',
			eyebrow: `${label} · No event`,
			imageUrl: null,
			metrics: [],
			players: [],
			title: label,
		}
	}
	const period = formatOgTournamentPeriod(type, tournament.slug)
	return {
		description: tournament.authorName ? `${period} · by ${tournament.authorName}` : period,
		eyebrow: `${label} · ${getOgTournamentStatus(tournament.startAt, tournament.endAt, now)}`,
		imageUrl: tournament.imageUrl,
		metrics: [
			{
				label: 'Competitors',
				value: formatOgEventNumber(tournament.competitorCount),
			},
			...(tournament.levelPoints == null
				? []
				: [
						{
							label: 'Level points',
							value: formatOgEventNumber(tournament.levelPoints),
						},
					]),
		],
		players: tournament.players,
		title: tournament.levelName,
	}
}

export function useOgTrackTournamentData(type: TrackTournamentType, slug: string) {
	const now = new Date()
	const rootSlug = type === 0 ? 'totw' : 'totm'
	if (slug === rootSlug) {
		const result = useQuery({
			query: Zc_TrackTournamentIndexDocument,
			variables: { type, now: now.toISOString(), first: 1 },
		})
		const data = computed(() => {
			const active = mapTournament(result.data.value?.active?.nodes[0])
			const future = mapTournament(result.data.value?.future?.nodes[0])
			const recent = mapTournament(result.data.value?.history?.edges[0]?.node)
			return trackTournamentView(type, active ?? future ?? recent, now)
		})
		async function prefetch() {
			if (import.meta.server) await result
		}
		return { data, prefetch, result }
	}

	const paused = !validTournamentSlug(type, slug)
	const result = useQuery({
		query: Zc_TrackTournamentDetailDocument,
		variables: {
			type,
			slug,
			viewerId: 0,
			includeViewer: false,
			first: 3,
		},
		pause: paused,
	})
	const data = computed(() => {
		const node = result.data.value?.tournament
		const summary = mapTournament(node)
		if (!node || !summary) return trackTournamentView(type, null, now)
		const leaderboardPlayers = mapPlayers(
			node.leaderboard?.edges.map(({ node: standing }) => standing) ?? [],
		)
		return trackTournamentView(
			type,
			{
				...summary,
				competitorCount: node.leaderboard?.totalCount ?? summary.competitorCount,
				players: leaderboardPlayers.length > 0 ? leaderboardPlayers : summary.players,
			},
			now,
		)
	})
	async function prefetch() {
		if (import.meta.server && !paused) await result
	}
	return { data, prefetch, result }
}
