const pageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null }
const connection = (nodes: object[]) => ({
	nodes,
	edges: nodes.map((node) => ({ cursor: 'medal', node })),
	totalCount: nodes.length,
	pageInfo,
})
const steamId = '76561198000000888'
const headerMedals: Record<string, { medal: number | null; time: number }> = {
	apex: { medal: 5, time: 35.2 },
	expert: { medal: 4, time: 37 },
	author: { medal: 3, time: 39 },
	gold: { medal: 2, time: 43 },
	silver: { medal: 1, time: 48 },
	bronze: { medal: 0, time: 55 },
	none: { medal: null, time: 65 },
}
const points = {
	points: 100,
	rank: 1,
	totalPoints: 200,
	personalBests: 28,
	worldRecords: 1,
	medalApex: 1,
	medalExpert: 2,
	medalAuthor: 3,
	medalGold: 4,
	medalSilver: 5,
	medalBronze: 6,
	medalNone: 7,
}
const user = {
	id: 888,
	steamId,
	steamName: 'Medal fixture',
	dateCreated: '2026-01-01T00:00:00Z',
	userPoints: points,
	records: { totalCount: 28 },
	levelItems: { totalCount: 0 },
	votes: { totalCount: 0, groupedAggregates: [] },
}

export function applyMedalFixtures(
	data: Record<string, unknown>,
	query: string,
	variables: Record<string, unknown>,
	level: Record<string, unknown>,
) {
	if (query.includes('ZC_AdventurePlayerLevels') && variables.playerId === 1) {
		const series = (variables.filter as { series?: { equalTo?: string } } | undefined)?.series
			?.equalTo
		data.adventureLevelMemberships = connection(
			[
				{ series: 'a', id: 9201, pb: 0, wr: 5 },
				{ series: 'a', id: 9202, pb: 1, wr: 4 },
				{ series: 'b', id: 9203, pb: 2, wr: 3 },
				{ series: 'b', id: 9204, pb: null, wr: 5 },
			]
				.filter((entry) => !series || entry.series === series)
				.map((entry) => ({
					series: entry.series,
					levelId: entry.id,
					levelItem: {
						id: entry.id,
						name: `Adventure medal ${entry.id}`,
						fileUid: `adventure-medal-${entry.id}`,
						workshopId: '0',
						fileAuthor: 'Fixture',
					},
					level: {
						id: entry.id,
						xxHash: `adventure-medal-${entry.id}`,
						personalBestGlobals: connection(
							entry.pb === null
								? []
								: [{ record: { id: entry.id, time: 55, medal: entry.pb } }],
						),
						worldRecordGlobal: {
							record: { id: entry.id + 100, time: 35, medal: entry.wr },
						},
					},
				})),
		)
	}
	if (
		query.includes('query ZC_Levels(') &&
		JSON.stringify(variables.filter ?? {}).includes('Medal card fixture')
	) {
		data.levels = connection(
			['Apex', 'Expert', 'Author', 'Gold', 'Silver', 'Bronze'].map((name, index) => ({
				...level,
				id: 9100 + index,
				xxHash: `medal-card-${index}`,
				levelItems: {
					nodes: (level.levelItems as { nodes: Record<string, unknown>[] }).nodes.map(
						(item) => ({
							...item,
							name: `Medal card fixture ${name}`,
						}),
					),
				},
				worldRecordGlobal: {
					record: { time: [35.2, 37, 39, 43, 48, 55][index], medal: 5 - index },
					user: { steamId, steamName: 'Medal card holder' },
				},
			})),
		)
	}
	if (query.includes('ZC_UserProfile') && variables.steamId === steamId)
		data.users = connection([user])
	if (query.includes('ZC_Users(') && JSON.stringify(variables.filter).includes('Medal fixture'))
		data.userPoints = connection([{ ...points, user }])
	const hash = String(variables.xxHash ?? '')
	const headerVariant =
		hash === 'medal-fixture-level'
			? 'apex'
			: hash.startsWith('medal-fixture-level-')
				? hash.slice('medal-fixture-level-'.length)
				: ''
	const headerMedal = headerMedals[headerVariant]
	if (query.includes('ZC_LevelDetail') && headerMedal)
		data.levelByXxHash = {
			...level,
			id: 9003,
			xxHash: hash,
			levelItems: {
				nodes: (level.levelItems as { nodes: Record<string, unknown>[] }).nodes.map(
					(item) => ({
						...item,
						validationTimeAuthor: 40,
						validationTimeExpert: 38.251,
						validationTimeApex: 36.433,
						medalDueAt: null,
						medalCalculatedAt: '2026-11-12T00:00:00Z',
						medalCalculationVersion: 2,
					}),
				),
			},
			records: { totalCount: 1 },
			personalBestGlobals: { totalCount: 1 },
			worldRecordGlobal: {
				record: {
					id: 9003,
					time: headerMedal.time,
					medal: headerMedal.medal,
					dateCreated: '2026-01-01T00:00:00Z',
					levelId: 9003,
					userId: 888,
					recordStatistic: { distance: 100 },
				},
				user,
			},
		}
	const filter = variables.filter as
		| {
				levelId?: { equalTo?: number }
				userId?: { equalTo?: number }
				levelPosition?: { equalTo?: number }
				worldRecordGlobalsExist?: boolean
				personalBestGlobalsExist?: boolean
		  }
		| undefined
	if (filter?.userId?.equalTo === 888) {
		const isWorldRecord = filter.levelPosition?.equalTo === 1 || filter.worldRecordGlobalsExist
		const isPersonalBest =
			query.includes('ZC_UserContributions') || filter.personalBestGlobalsExist
		const record = {
			id: isWorldRecord ? 9003 : isPersonalBest ? 9004 : 9005,
			time: isWorldRecord ? 35.2 : isPersonalBest ? 38 : 55,
			medal: isWorldRecord ? 5 : isPersonalBest ? 4 : 0,
			dateCreated: '2026-01-01T00:00:00Z',
			levelId: 9003,
			userId: 888,
			level,
			userPointContributions: { nodes: [] },
			personalBestGlobals: { totalCount: isWorldRecord || isPersonalBest ? 1 : 0 },
			worldRecordGlobals: { totalCount: isWorldRecord ? 1 : 0 },
		}
		if (query.includes('ZC_UserContributions'))
			data.userPointContributions = connection([
				{
					record,
					level,
					contributionRank: 1,
					levelPosition: isWorldRecord ? 1 : 2,
					levelPoints: 100,
					levelDecayedPoints: 100,
					playerDecayedPoints: 100,
				},
			])
		if (query.includes('ZC_UserResults')) data.records = connection([record])
	}
	if (query.includes('ZC_LevelRecords') && filter?.levelId?.equalTo === 9003)
		data.records = connection([
			{
				id: 9003,
				time: 35.2,
				medal: 5,
				dateCreated: '2026-01-01T00:00:00Z',
				levelId: 9003,
				userId: 888,
				user,
				userPointContributions: { nodes: [] },
				personalBestGlobals: { totalCount: 1 },
				worldRecordGlobals: { totalCount: 1 },
			},
		])
	if (query.includes('ZC_LevelPersonalBestRanks') && variables.levelId === 9003) {
		data.fasterPersonalBests = { totalCount: 0 }
		data.visiblePersonalBestTimes = {
			groupedAggregates: [{ keys: ['35.2'], distinctCount: { id: '1' } }],
		}
	}
}
