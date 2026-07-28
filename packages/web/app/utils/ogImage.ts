const numberFormatter = new Intl.NumberFormat('en-GB', {
	maximumFractionDigits: 2,
})

const compactNumberFormatter = new Intl.NumberFormat('en-GB', {
	compactDisplay: 'short',
	maximumFractionDigits: 1,
	notation: 'compact',
})

export type OgTournamentStatus = 'Finished' | 'Live now' | 'Upcoming'

export function getOgTournamentStatus(
	startAt: string,
	endAt: string,
	now: Date = new Date(),
): OgTournamentStatus {
	const start = Date.parse(startAt)
	const end = Date.parse(endAt)
	const current = now.getTime()
	if (Number.isFinite(start) && current < start) return 'Upcoming'
	if (Number.isFinite(end) && current < end) return 'Live now'
	return 'Finished'
}

/**
 * Forces nuxt-og-image to use its JSON props encoding for numeric-looking strings.
 * Flattened URL props are decoded with Number(), which loses precision for Steam IDs.
 * JSON serialization unboxes this value back to the original primitive string.
 */
export function preserveOgStringProp(value: string): string {
	return Object(value) as string
}

export function formatOgNumber(value: number | null | undefined): string {
	return value == null || !Number.isFinite(value) ? '—' : numberFormatter.format(value)
}

export function formatOgCompactNumber(value: number | null | undefined): string {
	return value == null || !Number.isFinite(value) ? '—' : compactNumberFormatter.format(value)
}

export function formatOgDistance(metres: number | null | undefined): string {
	if (metres == null || !Number.isFinite(metres)) return '—'
	const kilometres = metres / 1000
	return `${kilometres >= 100_000 ? compactNumberFormatter.format(kilometres) : numberFormatter.format(kilometres)} km`
}

export function formatOgTime(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const remainder = (seconds % 60).toFixed(3).padStart(6, '0')
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}`
		: `${minutes}:${remainder}`
}

export function normaliseOgImageUrl(value: string | null | undefined): string | undefined {
	if (!value) return undefined
	if (/^(?:assets|thumbnails)\//.test(value)) {
		return new URL(value, 'https://cdn.zeepki.st/').toString()
	}
	if (value.startsWith('//')) return undefined
	if (value.startsWith('/')) return value
	try {
		const url = new URL(value)
		return url.protocol === 'https:' &&
			(url.hostname === 'cdn.zeepki.st' ||
				url.hostname === 'assets.modcdn.io' ||
				url.hostname === 'thumb.modcdn.io')
			? url.toString()
			: undefined
	} catch {
		return undefined
	}
}

export function titleCaseSlug(value: string): string {
	return value
		.split(/[-_/]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ')
}
