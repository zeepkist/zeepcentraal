export function createDecayPercentageFormatter(
	locale: string,
	maximumFractionDigits = 1,
	minimumFractionDigits = 0,
) {
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		maximumFractionDigits,
		minimumFractionDigits,
	})
}
