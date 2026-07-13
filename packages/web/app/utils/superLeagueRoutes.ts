export function parseSuperLeagueSlug(value: unknown, prefix: string): number | null {
	if (typeof value !== 'string') return null
	const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value)
	if (!match?.[1]) return null
	const id = Number(match[1])
	return Number.isSafeInteger(id) && id > 0 ? id : null
}

export const superLeagueSeasonPath = (seasonId: number) => `/super-league/season-${seasonId}`

export const superLeagueRoundPath = (seasonId: number, roundNumber: number) =>
	`${superLeagueSeasonPath(seasonId)}/round-${roundNumber}`

export const superLeagueLevelPath = (seasonId: number, roundNumber: number, levelId: number) =>
	`${superLeagueRoundPath(seasonId, roundNumber)}/level-${levelId}`
