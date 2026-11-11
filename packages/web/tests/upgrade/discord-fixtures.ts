/** Distinct entity IDs keep preview fixtures separate from other upgrade scenarios. */
export const previewContest = {
	roundId: 777,
	contestId: 777,
	seasonId: 777,
	round: 1,
	name: 'Preview contest',
	rules: {},
	steamAnnouncementId: null,
	submissionStart: '2026-01-01T00:00:00Z',
	submissionEnd: '2026-12-01T00:00:00Z',
	zslVoteEnd: '2026-12-02T00:00:00Z',
	cosmeticVoteEnd: null,
	submissionsOpen: true,
	openTypes: [1],
	resultTypes: [],
}

export function applyDiscordFixtures(
	data: Record<string, unknown>,
	query: string,
	variables: Record<string, unknown> = {},
	level: Record<string, unknown>,
) {
	const pageInfo = {
		hasNextPage: false,
		hasPreviousPage: false,
		startCursor: null,
		endCursor: null,
	}
	const connection = (nodes: unknown[]) => ({
		nodes,
		edges: nodes.map((node, index) => ({ cursor: String(index), node })),
		totalCount: nodes.length,
		pageInfo,
	})
	const players = Array.from({ length: 3 }, (_, index) => ({
		id: 9500 + index,
		userId: index + 1,
		recordId: 9500 + index,
		tournamentId: 777,
		rank: index < 2 ? 1 : 3,
		position: index < 2 ? 1 : 3,
		points: 100 - index,
		time: 42 + index,
		dateCreated: '2026-10-01T00:00:00Z',
		user: {
			id: index + 1,
			steamId: String(76561198000000000n + BigInt(index)),
			steamName: `Preview player ${index + 1}`,
			zslLevelResults: { totalCount: 1 },
			zslRoundResults: { nodes: [] },
		},
		record: { id: 9500 + index, dateCreated: '2026-10-01T00:00:00Z' },
		userPointContributions: {
			nodes: [
				{
					levelPosition: index < 2 ? 1 : 3,
					contributionRank: 1,
					levelPoints: 100,
					levelDecayedPoints: 100,
					playerDecayedPoints: 100,
				},
			],
		},
	}))
	const season = {
		id: 777,
		name: 'Preview season',
		startDate: '2026-01-01',
		endDate: '2026-12-01',
		pointsStructure: { bestOf: 6 },
		zslRounds: connection([]),
	}
	const round = {
		id: 777,
		seasonId: 777,
		round: 1,
		name: 'Preview round',
		eventDate: '2026-10-01',
		season: { name: season.name },
		zslLevels: connection([]),
	}
	if (query.includes('query ZC_ZslSeason(') && variables.id === 777) data.zslSeason = season
	if (query.includes('query ZC_ZslRoundBySeasonAndNumber(') && variables.seasonId === 777)
		data.zslRounds = connection([round])
	if (query.includes('query ZC_ZslLevel(') && variables.id === 777)
		data.zslLevel = {
			id: 777,
			roundId: 777,
			round,
			level,
			zslLevelResults: { aggregates: { min: { time: 42 } } },
		}
	for (const [operation, key] of [
		['ZC_ZslSeasonResults', 'zslSeasonResults'],
		['ZC_ZslRoundResults', 'zslRoundResults'],
		['ZC_ZslLevelResults', 'zslLevelResults'],
	]) {
		if (
			query.includes(`query ${operation}(`) &&
			(variables.id === 777 || variables.seasonId === 777)
		) {
			data[key as string] = connection(players)
			data.viewerStanding = connection([
				{ ...players[0], user: { steamId: '999', steamName: 'PRIVATE PINNED PLAYER' } },
			])
		}
	}
	if (
		query.includes('query ZC_TrackTournamentDetail(') &&
		['2026-w01', '2026-01', '2026-11-11'].includes(String(variables.slug))
	)
		data.tournament = {
			id: 777,
			type: variables.type,
			slug: variables.slug,
			startAt: '2026-01-01T00:00:00Z',
			endAt: '2026-01-08T00:00:00Z',
			finalizedAt: '2026-01-08T00:00:00Z',
			level,
			trackTournamentResults: connection(players),
			leaderboard: connection(players),
			ghostFeed: connection([]),
			updateFeed: connection([]),
			viewerStanding: connection([]),
		}
	if (
		query.includes('query ZC_LevelRecords(') &&
		(variables.filter as { levelId?: { equalTo?: number } })?.levelId?.equalTo === 9001
	)
		data.records = connection(players)
	if (query.includes('query ZC_AdventureLeaderboard('))
		data.adventureLeaderboard = {
			series: variables.series,
			totalLevels: 5,
			totalPlayers: 3,
			entries: connection(
				players.map((player) => ({
					...player,
					completedLevels: 5,
					totalLevels: 5,
					remainingLevels: 0,
					totalTimeMs: '42000',
					isComplete: true,
				})),
			),
			playerEntry: null,
		}
	if (query.includes('query ZC_WorkshopDetail(') && variables.workshopId === '777')
		data.workshopItem = {
			workshopId: '777',
			name: 'Preview workshop',
			imageUrl: '/android-chrome-512x512.png',
			authorId: '76561198000000000',
			author: { steamName: 'Preview author' },
			createdAt: '2026-01-01',
			updatedAt: '2026-10-01',
			fileSize: 42,
		}
	if (query.includes('query ZC_UserProfile(') && variables.steamId === '76561198000000777')
		data.users = connection([
			{
				id: 777,
				steamId: variables.steamId,
				steamName: 'Preview profile',
				dateCreated: '2026-01-01',
				userPoints: {
					points: 100,
					rank: 5,
					totalPoints: 200,
					personalBests: 12,
					worldRecords: 3,
				},
				records: { totalCount: 20 },
				levelItems: { totalCount: 1 },
				votes: { totalCount: 0, groupedAggregates: [] },
			},
		])
}
