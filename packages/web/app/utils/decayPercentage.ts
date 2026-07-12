export function createDecayPercentageFormatter(locale: string) {
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits: 1,
	})
}
