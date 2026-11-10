/** Sparse observations: old renderer registered over 450 gap series in the player chart. */
export function sparseLobbyStatistics(now = Date.now(), update = 0) {
	const end = Math.floor(now / 300_000) * 300_000
	const start = end - 86_400_000
	const aggregate = (players: number) => ({
		average: { players, playersInRooms: players / 2, rooms: 4 },
		sum: { players, playersInRooms: players / 2, rooms: 4 },
		max: { players, playersInRooms: players / 2, rooms: 4 },
		distinctCount: { id: '1' },
	})
	const values = Array.from({ length: 96 }, (_, index) => ({
		time: start + index * 900_000,
		players: 100 + (index % 5) + (index === 0 ? update : 0),
	}))
	// Interior peak lies between adjacent samples, not at a gap endpoint.
	values.push({ time: start + 47 * 900_000 + 300_000, players: 1000 })
	values.push({ time: start + 47 * 900_000 + 600_000, players: 110 })
	values.sort((left, right) => left.time - right.time)
	const peakTime = new Date(start + 47 * 900_000 + 300_000).toISOString()
	return {
		latest: {
			nodes: [
				{
					players: 104,
					playersInRooms: 52,
					rooms: 4,
					dateCreated: new Date(end).toISOString(),
				},
			],
		},
		coverage: { nodes: [{ dateCreated: new Date(start).toISOString() }] },
		period: {
			nodes: [{ dateCreated: new Date(start).toISOString() }],
			aggregates: aggregate(100),
			groupedAggregates: values.map((value) => ({
				keys: [new Date(value.time).toISOString()],
				...aggregate(value.players),
			})),
		},
		previous: { nodes: [], aggregates: aggregate(100) },
		previousEnd: { nodes: [] },
		onlinePeak: { nodes: [{ players: 1000, dateCreated: peakTime }] },
		participationPeak: { nodes: [{ playersInRooms: 500, dateCreated: peakTime }] },
		roomsPeak: { nodes: [{ rooms: 4, dateCreated: peakTime }] },
		roomPeak: { nodes: [] },
	}
}
