export function getLineChartYDomain(
	data: readonly Record<string, unknown>[],
	seriesKeys: readonly string[],
	step: number | ((value: number) => number) = 2,
): [number, number] | undefined {
	let minimum = Infinity
	let maximum = -Infinity

	for (const point of data) {
		for (const key of seriesKeys) {
			const value = point[key]
			if (typeof value !== 'number' || !Number.isFinite(value)) continue
			minimum = Math.min(minimum, value)
			maximum = Math.max(maximum, value)
		}
	}

	if (minimum === Infinity) return undefined
	const minimumStep = typeof step === 'number' ? step : step(minimum)
	const maximumStep = typeof step === 'number' ? step : step(maximum)
	return [
		minimumStep * Math.floor(minimum / minimumStep),
		maximumStep * (Math.floor(maximum / maximumStep) + 1),
	]
}

export function getEvenlySpacedYAxis(domain: readonly [number, number], unit: number) {
	const minimum = unit * Math.floor(domain[0] / unit)
	const span = Math.ceil((domain[1] - minimum) / unit)
	let intervals = Math.min(4, span)
	let step = Math.ceil(span / intervals)

	// Keep both endpoints when possible. Otherwise, prefer the least extra headroom.
	for (let count = intervals - 1; count >= 2; count--) {
		const candidateStep = Math.ceil(span / count)
		if (candidateStep * count >= step * intervals) continue
		intervals = count
		step = candidateStep
	}

	const axisDomain: [number, number] = [minimum, minimum + intervals * step * unit]
	const ticks = Array.from({ length: intervals + 1 }, (_, index) => minimum + index * step * unit)
	return { domain: axisDomain, ticks }
}
