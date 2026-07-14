export function createLevelRatingFormatter(locale: string) {
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits: 0,
	})
}
