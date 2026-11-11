import { formatAdventureTime } from './adventureLeaderboard'
import { formatOgTime } from './ogImage'

export interface DiscordPreviewRow {
	name: string
	rank?: number | null
	url?: string | null
	value?: string | null
}

/** Accept only public standing fields, never viewer-specific decorations or pinned rows. */
export function discordStandingRow(row: {
	rank?: number | null
	position?: number | null
	points?: number | null
	totalPoints?: number | null
	time?: number | null
	completedLevels?: number | null
	totalLevels?: number | null
	totalTimeMs?: unknown
	steamId?: unknown
	steamName?: string | null
	user?: { steamId?: unknown; steamName?: string | null } | null
}): DiscordPreviewRow {
	const steamId = row.user?.steamId ?? row.steamId
	const points = row.points ?? row.totalPoints
	return {
		name:
			row.user?.steamName ??
			row.steamName ??
			(steamId == null ? 'Unknown player' : String(steamId)),
		url: steamId == null ? undefined : `/user/${encodeURIComponent(String(steamId))}`,
		rank: row.rank ?? row.position,
		value:
			row.completedLevels != null
				? `${row.completedLevels}/${row.totalLevels ?? '?'} levels | ${formatAdventureTime(row.totalTimeMs)}`
				: [
						row.time == null ? undefined : formatOgTime(row.time),
						points == null ? undefined : `${points.toLocaleString('en-GB')} points`,
					]
						.filter(Boolean)
						.join(' | '),
	}
}

export interface DiscordPreview {
	description?: string | null
	image?: string | null
	links?: Array<{ label: string; url: string }>
	resultLabel?: string
	rows?: DiscordPreviewRow[]
	title: string
}

type TextDisplay = { type: 10; content: string }
type LinkButton = { type: 2; style: 5; label: string; url: string }
type PreviewComponent =
	| TextDisplay
	| { type: 9; components: TextDisplay[]; accessory: { type: 11; media: { url: string } } }
	| { type: 1; components: LinkButton[] }
	| { type: 14 }

export interface DiscordComponentEmbed {
	component: { type: 17; accent_color: number; components: PreviewComponent[] }
}

export const DISCORD_EMBED_ID = 'discord:component-embed'
export const DISCORD_EMBED_LIMIT = 3000

export function discordNavigation(path: string): NonNullable<DiscordPreview['links']> {
	const root = path.split('/')[1]
	if (root === 'totw' || root === 'totm')
		return [
			{ label: 'Overall standings', url: `/${root}/overall` },
			{ label: 'Current event', url: `/${root}` },
		]
	if (root === 'super-league') return [{ label: 'Super League', url: '/super-league' }]
	if (root === 'wiki') return [{ label: 'Wiki', url: '/wiki' }]
	if (root === 'developer')
		return [
			{ label: 'Developer resources', url: '/developer' },
			{ label: 'GraphQL API', url: '/developer/graphql' },
		]
	if (root === 'playlist')
		return [
			{ label: 'Browse levels', url: '/levels' },
			{ label: 'Workshop', url: '/workshop' },
		]
	if (root === 'cosmetic' || root === 'cosmetics')
		return [{ label: 'Cosmetics', url: '/cosmetics' }]
	if (root === 'support' || root === 'privacy' || root === 'terms')
		return [{ label: 'ZeepCentraal', url: '/' }]
	return []
}

export function discordUrl(value: string | null | undefined, origin: string): string | undefined {
	if (!value) return
	try {
		const url = new URL(value, origin)
		if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return
		if (url.href.length <= 2048) return url.href
	} catch {
		// Invalid external media and links are optional.
	}
}

export function discordText(value: string, limit = 180): string {
	return Array.from(value)
		.map((character) =>
			character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character,
		)
		.slice(0, limit)
		.join('')
		.replace(/([\\`*_{}[\]()<>~|#])/g, '\\$1')
		.replace(/@/g, '@\u200b')
}

function markdownLink(name: string, value: string | null | undefined, origin: string): string {
	const url = discordUrl(value, origin)
	return url ? `[${name}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : name
}

/** Serialize before measuring: HTML-safe escapes count toward Discord's byte limit. */
export function serializeDiscordEmbed(payload: DiscordComponentEmbed): string {
	return JSON.stringify(payload)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
}

export function buildDiscordEmbed(preview: DiscordPreview, pageUrl: string): string | undefined {
	const url = discordUrl(pageUrl, pageUrl)
	if (!url) return
	const origin = new URL(url).origin
	for (const budget of [180, 100, 50, 24]) {
		const components: PreviewComponent[] = []
		const heading: TextDisplay = {
			type: 10,
			content: `## ${budget >= 100 ? markdownLink(discordText(preview.title, budget), url, origin) : discordText(preview.title, budget)}${preview.description && budget >= 50 ? `\n${discordText(preview.description, budget * 2)}` : ''}`,
		}
		const media =
			preview.image && /^(?:assets|thumbnails)\//.test(preview.image)
				? new URL(preview.image, 'https://cdn.zeepki.st/').href
				: preview.image
		const image = budget >= 100 ? discordUrl(media, origin) : undefined
		components.push(
			image
				? { type: 9, components: [heading], accessory: { type: 11, media: { url: image } } }
				: heading,
		)
		if (preview.rows) {
			components.push(
				{ type: 14 },
				{
					type: 10,
					content: preview.rows.length
						? [
								`**${discordText(preview.resultLabel ?? 'Results', budget)}**`,
								...preview.rows
									.slice(0, 3)
									.map(
										(row) =>
											`${row.rank != null && row.rank > 0 ? `#${row.rank} ` : ''}${markdownLink(discordText(row.name, budget), budget >= 50 ? row.url : undefined, origin)}${row.value ? ` | ${discordText(row.value, budget)}` : ''}`,
									),
							].join('\n')
						: 'No results.',
				},
			)
		}
		const links = [{ label: 'Open page', url }, ...(preview.links ?? [])]
		const buttons = links
			.flatMap((link): LinkButton[] => {
				const target = discordUrl(link.url, origin)
				return target
					? [
							{
								type: 2,
								style: 5,
								label: Array.from(link.label).slice(0, 80).join(''),
								url: target,
							},
						]
					: []
			})
			.filter(
				(button, index, all) =>
					all.findIndex((other) => other.url === button.url) === index,
			)
		components.push({
			type: 1,
			components: buttons.slice(0, budget >= 100 ? 5 : budget >= 50 ? 2 : 1),
		})
		const serialized = serializeDiscordEmbed({
			component: { type: 17, accent_color: 0xeab308, components },
		})
		if (new TextEncoder().encode(serialized).byteLength <= DISCORD_EMBED_LIMIT)
			return serialized
	}
	// An unusually long URL can leave too little room even after text is shortened.
	// Keep the standard Open Graph fallback rather than emit an invalid payload.
}

export function isDiscordPreviewPage(path: string): boolean {
	return !/^\/(?:settings|admin)(?:\/|$)/.test(path) && !/^\/records\/me(?:\/|$)/.test(path)
}

const publicQueryKeys = new Set([
	'q',
	'author',
	'sort',
	'adventure',
	'pointsMin',
	'pointsMax',
	'ratingMin',
	'ratingMax',
	'view',
	'roundId',
	'page',
	'tags',
	'tag',
	'essential',
	'range',
	'peak',
	'after',
	'before',
	'last',
	'status',
	'region',
	'version',
	'locked',
	'name',
	'active',
	'host',
	'visibility',
	'capacity',
	'populated',
	'duration',
	'from',
	'to',
	'minPeak',
	'maxPeak',
])

export function discordPageUrl(
	path: string,
	query: Record<string, unknown>,
	origin: string,
): string {
	const url = new URL(path, origin)
	for (const [key, value] of Object.entries(query)) {
		if (
			!publicQueryKeys.has(key) &&
			!/^(?:adventure|overall|standings|history|season|round|level|levels|records|workshop|pbs|recent|wr|pb|userTotw|userTotm|favourites)(?:After|Before|Last)$/.test(
				key,
			)
		)
			continue
		for (const item of Array.isArray(value) ? value : [value]) {
			if (typeof item === 'string') url.searchParams.append(key, item)
		}
	}
	return url.href
}
