import type { TrackTournamentType } from '../../app/types/tournament'
import { formatTournamentPeriod, validTournamentSlug } from '../../app/utils/tournament'

export type TournamentPlaylistRequest = {
	type?: TrackTournamentType
	slug?: string
}

export function tournamentPlaylistIdentity(request: TournamentPlaylistRequest): {
	filename: string
	name: string
} {
	if (request.type === undefined) {
		return {
			filename: 'zeepcentraal-tournaments-all.zeeplist',
			name: 'ZeepCentraal Track Tournaments',
		}
	}
	const shortName = request.type === 0 ? 'totw' : request.type === 2 ? 'totd' : 'totm'
	const formatName =
		request.type === 0
			? 'Track of the Week'
			: request.type === 2
				? 'Track of the Day'
				: 'Track of the Month'
	if (!request.slug) {
		return {
			filename: `zeepcentraal-${shortName}-all.zeeplist`,
			name: `ZeepCentraal ${formatName}`,
		}
	}
	const period = formatTournamentPeriod(
		request.type,
		request.slug,
		'en',
		({ year, week }) => `${year} Week ${week}`,
	)
	return {
		filename: `zeepcentraal-${shortName}-${request.slug}.zeeplist`,
		name: `ZeepCentraal ${formatName} ${period}`,
	}
}

function singleQueryValue(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

export function parseTournamentPlaylistQuery(
	query: Record<string, unknown>,
): TournamentPlaylistRequest {
	const rawType = singleQueryValue(query.type)
	const slug = singleQueryValue(query.slug)
	if (query.type !== undefined && rawType === undefined)
		throw new Error('Invalid tournament type')
	if (query.slug !== undefined && slug === undefined) throw new Error('Invalid tournament slug')
	if (rawType !== undefined && rawType !== '0' && rawType !== '1' && rawType !== '2') {
		throw new Error('Invalid tournament type')
	}
	if (slug !== undefined && rawType === undefined) throw new Error('Tournament type is required')

	const type = rawType === undefined ? undefined : (Number(rawType) as TrackTournamentType)
	if (slug !== undefined && type !== undefined && !validTournamentSlug(type, slug)) {
		throw new Error('Invalid tournament slug')
	}
	return { type, slug }
}

export async function collectTournamentPlaylistPages<T>(
	fetchPage: (after?: string) => Promise<{
		nodes: T[]
		pageInfo: { endCursor?: unknown; hasNextPage: boolean }
	}>,
): Promise<T[]> {
	const nodes: T[] = []
	const cursors = new Set<string>()
	let after: string | undefined
	do {
		const page = await fetchPage(after)
		nodes.push(...page.nodes)
		if (!page.pageInfo.hasNextPage) break
		const next = String(page.pageInfo.endCursor ?? '')
		if (!next || cursors.has(next)) throw new Error('Invalid tournament playlist cursor')
		cursors.add(next)
		after = next
	} while (after)
	return nodes
}
