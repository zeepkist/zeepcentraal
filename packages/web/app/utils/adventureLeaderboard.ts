export function formatAdventureTime(milliseconds: unknown): string {
	const value = Math.max(0, Number(milliseconds ?? 0))
	const hours = Math.floor(value / 3_600_000)
	const minutes = Math.floor(value / 60_000) % 60
	const seconds = Math.floor(value / 1000) % 60
	const fraction = String(value % 1000).padStart(3, '0')
	const body = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${fraction}`
	return hours ? `${hours}:${body}` : body
}
