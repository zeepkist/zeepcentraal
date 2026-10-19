/** CSS minification can rewrite millisecond tokens into seconds. WAAPI expects milliseconds. */
export function cssTimeToMilliseconds(value: string): number {
	const time = value.trim()
	return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000)
}
