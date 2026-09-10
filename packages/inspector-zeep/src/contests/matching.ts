export function parseContestTitle(title: string) {
	const match = /^S([1-9]\d*)R([1-9]\d*)\s+(.+)$/.exec(title.trim())
	if (!match) return undefined
	const season = Number(match[1])
	const round = Number(match[2])
	if (!Number.isSafeInteger(season) || !Number.isSafeInteger(round)) return undefined
	return { season, round, theme: match[3]!.trim() }
}
