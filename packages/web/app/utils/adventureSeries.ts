export const ADVENTURE_SERIES = [
	{ key: 'A', slug: 'a', prefix: 'A-', countField: 'seriesA' },
	{ key: 'B', slug: 'b', prefix: 'B-', countField: 'seriesB' },
	{ key: 'C', slug: 'c', prefix: 'C-', countField: 'seriesC' },
	{ key: 'CL', slug: 'cl', prefix: 'CL-', countField: 'seriesCl' },
	{ key: 'D', slug: 'd', prefix: 'D-', countField: 'seriesD' },
	{ key: 'E', slug: 'e', prefix: 'E-', countField: 'seriesE' },
	{ key: 'EZ', slug: 'ez', prefix: 'EZ-', countField: 'seriesEz' },
	{ key: 'F', slug: 'f', prefix: 'F-', countField: 'seriesF' },
	{ key: 'FL', slug: 'fl', prefix: 'FL-', countField: 'seriesFl' },
	{ key: 'G', slug: 'g', prefix: 'G-', countField: 'seriesG' },
	{ key: 'H', slug: 'h', prefix: 'H-', countField: 'seriesH' },
	{ key: 'I', slug: 'i', prefix: 'I-', countField: 'seriesI' },
	{ key: 'L', slug: 'l', prefix: 'L-', countField: 'seriesL' },
	{ key: 'OR', slug: 'or', prefix: 'OR-', countField: 'seriesOr' },
	{ key: 'X', slug: 'x', prefix: 'X-', countField: 'seriesX' },
	{ key: 'XG', slug: 'xg', prefix: 'XG-', countField: 'seriesXg' },
	{ key: 'Y', slug: 'y', prefix: 'Y-', countField: 'seriesY' },
] as const

export type AdventureSeriesDefinition = (typeof ADVENTURE_SERIES)[number]
export type AdventureSeriesSlug = AdventureSeriesDefinition['slug']

export function findAdventureSeries(value: unknown): AdventureSeriesDefinition | undefined {
	if (typeof value !== 'string') return undefined
	return ADVENTURE_SERIES.find((series) => series.slug === value)
}

export function adventureLevelNumber(name: string, series: AdventureSeriesDefinition) {
	const match = new RegExp(`^${series.key}-(\\d+)$`, 'i').exec(name)
	return match?.[1] == null ? null : Number.parseInt(match[1], 10)
}

export function sortAdventureLevels<T extends { name: string }>(
	levels: T[],
	series: AdventureSeriesDefinition,
) {
	return levels
		.map((level) => ({ level, number: adventureLevelNumber(level.name, series) }))
		.filter((entry): entry is { level: T; number: number } => entry.number !== null)
		.sort(
			(left, right) =>
				left.number - right.number || left.level.name.localeCompare(right.level.name),
		)
		.map((entry) => entry.level)
}
