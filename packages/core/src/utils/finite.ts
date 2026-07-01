export function finite(...values: number[]): boolean {
	return values.every(Number.isFinite)
}
