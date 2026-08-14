export function createLevelRatingFormatter(locale: string) {
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits: 0,
	})
}

export function isLevelRatingAvailable(
	rating: number | null | undefined,
	voteCount: number | undefined,
): rating is number {
	return rating != null && (voteCount ?? 0) >= 5
}
