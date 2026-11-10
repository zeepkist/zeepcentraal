export type LobbyChartPixelPoint = {
	x: number | null
	y: number | null
	payload?: unknown
}

/** One SVG path with separate subpaths; never registers gap endpoints as chart data. */
export function lobbyGapPath(points: readonly LobbyChartPixelPoint[]): string {
	const paths: string[] = []
	let previous: { x: number; y: number } | undefined
	let gap = false
	for (const point of points) {
		const payload = point.payload
		if (payload && typeof payload === 'object' && 'break' in payload && payload.break === 1) {
			previous = undefined
			gap = false
		} else if (
			typeof point.x !== 'number' ||
			!Number.isFinite(point.x) ||
			typeof point.y !== 'number' ||
			!Number.isFinite(point.y)
		) {
			gap = true
		} else {
			if (previous && gap) paths.push(`M${previous.x},${previous.y}L${point.x},${point.y}`)
			previous = { x: point.x, y: point.y }
			gap = false
		}
	}
	return paths.join(' ')
}
