import postgres from 'postgres'

type Sql = postgres.Sql<Record<string, never>>

const stringify = (value: unknown) =>
	JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item))

const assertEqual = (actual: unknown, expected: unknown, label: string) => {
	if (stringify(actual) !== stringify(expected)) {
		throw new Error(`${label}: expected ${stringify(expected)}, received ${stringify(actual)}`)
	}
}

const assertLength = (actual: unknown[], expected: number, label: string) => {
	if (actual.length !== expected) {
		throw new Error(`${label}: expected ${expected} rows, received ${actual.length}`)
	}
}

const insertLevelItem = async (
	sql: Sql,
	options: {
		levelId: number
		workshopId: string
		name: string
		deleted?: boolean
		authorTime?: number
	},
) => {
	const [item] = await sql<{ id: number }[]>`
		INSERT INTO public.level_item (
			id_level,
			workshop_id,
			author_id,
			name,
			image_url,
			file_author,
			file_uid,
			validation_time_author,
			validation_time_gold,
			validation_time_silver,
			validation_time_bronze,
			deleted,
			created_at,
			updated_at
		)
		VALUES (
			${options.levelId},
			${options.workshopId},
			-990000000000001,
			${options.name},
			'https://example.invalid/level.png',
			'RLS Integration',
			${`${options.name}-file`},
			${options.authorTime ?? 60},
			70,
			80,
			90,
			${options.deleted ?? false},
			now(),
			now()
		)
		RETURNING id
	`

	if (!item) throw new Error('Failed to create level-item fixture')
	return item.id
}

const setGraphqlRole = (sql: Sql) => sql.unsafe('SET LOCAL ROLE zeepcentraal_graphql')
const resetRole = (sql: Sql) => sql.unsafe('RESET ROLE')

export const verifyGraphqlVisibility = async (databaseUrl: string) => {
	const sql = postgres(databaseUrl, { max: 1 })
	await sql`BEGIN`

	try {
		await sql`
				INSERT INTO public."user" (steam_name, steam_id, banned)
				VALUES ('RLS Integration', -990000000000001, false)
			`
		const [fixtureUser] = await sql<{ id: number }[]>`
				SELECT id
				FROM public."user"
				WHERE steam_id = -990000000000001
			`
		if (!fixtureUser) throw new Error('Failed to create user fixture')

		const levelKinds = [
			'adventure',
			'orphan',
			'public',
			'unlisted',
			'friends',
			'hidden',
			'deleted-only',
			'aliases',
		] as const
		const levelIds = new Map<(typeof levelKinds)[number], number>()

		for (const kind of levelKinds) {
			const [createdLevel] = await sql<{ id: number }[]>`
					INSERT INTO public.level (hash, xx_hash, adventure)
					VALUES (
						${`rls-integration-${kind}`},
						${`000000000000000000000000-rls-${kind}`},
						${kind === 'adventure'}
					)
					RETURNING id
				`
			if (!createdLevel) throw new Error(`Failed to create ${kind} level fixture`)
			levelIds.set(kind, createdLevel.id)
		}

		const workshopVisibility = new Map<string, number>([
			['-990000000000101', 0],
			['-990000000000102', 3],
			['-990000000000103', 1],
			['-990000000000104', 2],
			['-990000000000105', 0],
			['-990000000000106', 0],
			['-990000000000107', 2],
		])

		for (const [workshopId, visibility] of workshopVisibility) {
			await sql`
					INSERT INTO public.workshop_item (
						workshop_id,
						author_id,
						name,
						image_url,
						visibility
					)
					VALUES (
						${workshopId},
						-990000000000001,
						${`RLS ${visibility}`},
						'https://example.invalid/workshop.png',
						${visibility}
					)
				`
		}

		const itemIds = {
			adventureHidden: await insertLevelItem(sql, {
				levelId: levelIds.get('adventure') as number,
				workshopId: '-990000000000107',
				name: 'RLS Adventure Hidden Item',
			}),
			adventureDeleted: await insertLevelItem(sql, {
				levelId: levelIds.get('adventure') as number,
				workshopId: '-990000000000107',
				name: 'RLS Adventure Deleted Item',
				deleted: true,
			}),
			public: await insertLevelItem(sql, {
				levelId: levelIds.get('public') as number,
				workshopId: '-990000000000101',
				name: 'RLS Public',
				authorTime: 91001,
			}),
			unlisted: await insertLevelItem(sql, {
				levelId: levelIds.get('unlisted') as number,
				workshopId: '-990000000000102',
				name: 'RLS Unlisted',
				authorTime: 91002,
			}),
			friends: await insertLevelItem(sql, {
				levelId: levelIds.get('friends') as number,
				workshopId: '-990000000000103',
				name: 'RLS Friends',
			}),
			hidden: await insertLevelItem(sql, {
				levelId: levelIds.get('hidden') as number,
				workshopId: '-990000000000104',
				name: 'RLS Hidden',
				authorTime: 91004,
			}),
			deletedOnly: await insertLevelItem(sql, {
				levelId: levelIds.get('deleted-only') as number,
				workshopId: '-990000000000105',
				name: 'RLS Deleted Only',
				deleted: true,
			}),
			aliasPublic: await insertLevelItem(sql, {
				levelId: levelIds.get('aliases') as number,
				workshopId: '-990000000000106',
				name: 'RLS Public Alias',
			}),
			aliasHidden: await insertLevelItem(sql, {
				levelId: levelIds.get('aliases') as number,
				workshopId: '-990000000000107',
				name: 'RLS Hidden Alias',
			}),
		}

		for (const levelId of levelIds.values()) {
			await sql`
				INSERT INTO public.level_metadata (
					id_level,
					amount_checkpoints,
					amount_finishes,
					amount_blocks,
					type_ground,
					type_skybox,
					blocks
				)
				VALUES (${levelId}, 1, 1, 1, 0, 0, '[]'::jsonb)
			`
		}

		const allFixtureLevelIds = [...levelIds.values()]
		await setGraphqlRole(sql)
		const initialLevels = await sql<{ id: number; publiclyVisible: boolean }[]>`
				SELECT id, publicly_visible AS "publiclyVisible"
				FROM public.level
				WHERE id = ANY(${sql.array(allFixtureLevelIds)}::integer[])
				ORDER BY id
			`
		await resetRole(sql)
		assertEqual(
			initialLevels.map((row) => row.id).sort(),
			allFixtureLevelIds.sort(),
			'all level shells remain visible',
		)
		assertEqual(
			initialLevels
				.filter((row) => row.publiclyVisible)
				.map((row) => row.id)
				.sort(),
			[levelIds.get('adventure'), levelIds.get('public'), levelIds.get('aliases')].sort(),
			'initial discovery visibility',
		)

		const insertRecord = async (levelId: number, time: number) => {
			const [createdRecord] = await sql<{ id: number }[]>`
					INSERT INTO public.record (
						id_user,
						time,
						game_version,
						id_level,
						mod_version
					)
					VALUES (${fixtureUser.id}, ${time}, 'RLS', ${levelId}, '1.2.0')
					RETURNING id
				`
			if (!createdRecord) throw new Error('Failed to create record fixture')
			return createdRecord.id
		}

		const firstUnlistedRecord = await insertRecord(levelIds.get('unlisted') as number, 60)
		const secondUnlistedRecord = await insertRecord(levelIds.get('unlisted') as number, 61)
		const publicRecord = await insertRecord(levelIds.get('public') as number, 62)
		const friendsRecord = await insertRecord(levelIds.get('friends') as number, 63)
		const hiddenRecord = await insertRecord(levelIds.get('hidden') as number, 64)

		await sql`
				INSERT INTO public.record_media (id_record, ghost_url)
				VALUES
					(${publicRecord}, 'https://example.invalid/public.ghost'),
					(${hiddenRecord}, 'https://example.invalid/hidden.ghost')
			`
		await sql`
				INSERT INTO public.record_statistic (id_record, ghost_version)
				VALUES (${publicRecord}, 6), (${hiddenRecord}, 6)
			`
		await sql`
				INSERT INTO public.personal_best_global (id_record, id_user, id_level)
				VALUES
					(${publicRecord}, ${fixtureUser.id}, ${levelIds.get('public') as number}),
					(${hiddenRecord}, ${fixtureUser.id}, ${levelIds.get('hidden') as number})
			`
		await sql`
			INSERT INTO public.world_record_global (id_record, id_user, id_level)
				VALUES
					(${publicRecord}, ${fixtureUser.id}, ${levelIds.get('public') as number}),
				(${hiddenRecord}, ${fixtureUser.id}, ${levelIds.get('hidden') as number})
		`
		const [pointsStructure] = await sql<{ id: number }[]>`
			INSERT INTO public.zsl_points_structure (name, points, minimum_points, best_of)
			VALUES ('RLS Integration', ARRAY[10], 1, 1)
			RETURNING id
		`
		if (!pointsStructure) throw new Error('Failed to create ZSL points fixture')
		const [season] = await sql<{ id: number }[]>`
			INSERT INTO public.zsl_season (
				id_points_structure,
				name,
				start_date,
				end_date
			)
			VALUES (${pointsStructure.id}, 'RLS Integration', now(), now() + interval '1 day')
			RETURNING id
		`
		if (!season) throw new Error('Failed to create ZSL season fixture')
		const [round] = await sql<{ id: number }[]>`
			INSERT INTO public.zsl_round (id_season, name, round, workshop_id, event_date)
			VALUES (${season.id}, 'RLS Integration', 1, -990000000000201, now())
			RETURNING id
		`
		if (!round) throw new Error('Failed to create ZSL round fixture')
		const [publicZslLevel] = await sql<{ id: number }[]>`
			INSERT INTO public.zsl_level (id_round, id_level)
			VALUES (${round.id}, ${levelIds.get('public') as number})
			RETURNING id
		`
		const [hiddenZslLevel] = await sql<{ id: number }[]>`
			INSERT INTO public.zsl_level (id_round, id_level)
			VALUES (${round.id}, ${levelIds.get('hidden') as number})
			RETURNING id
		`
		if (!publicZslLevel || !hiddenZslLevel)
			throw new Error('Failed to create ZSL level fixtures')
		await sql`
			INSERT INTO public.zsl_level_result (
				id_level,
				id_user,
				id_record,
				position,
				points,
				time
			)
			VALUES
				(${publicZslLevel.id}, ${fixtureUser.id}, ${publicRecord}, 1, 10, 62),
				(${hiddenZslLevel.id}, ${fixtureUser.id}, ${hiddenRecord}, 1, 10, 64)
		`

		await setGraphqlRole(sql)
		const visibleUnlisted = await sql<{ id: number }[]>`
				SELECT id
				FROM public.level
				WHERE id = ${levelIds.get('unlisted') as number}
					AND publicly_visible = true
			`
		const visibleRecords = await sql<{ id: number }[]>`
				SELECT id
				FROM public.record
				WHERE id = ANY(${sql.array([publicRecord, friendsRecord, hiddenRecord])}::integer[])
			`
		const visibleMedia = await sql<{ idRecord: number }[]>`
				SELECT id_record AS "idRecord"
				FROM public.record_media
				WHERE id_record = ANY(${sql.array([publicRecord, hiddenRecord])}::integer[])
			`
		const visibleStatistics = await sql<{ idRecord: number }[]>`
				SELECT id_record AS "idRecord"
				FROM public.record_statistic
				WHERE id_record = ANY(${sql.array([publicRecord, hiddenRecord])}::integer[])
			`
		const visiblePersonalBests = await sql<{ idRecord: number }[]>`
				SELECT id_record AS "idRecord"
				FROM public.personal_best_global
				WHERE id_record = ANY(${sql.array([publicRecord, hiddenRecord])}::integer[])
			`
		const visibleWorldRecords = await sql<{ idRecord: number }[]>`
				SELECT id_record AS "idRecord"
				FROM public.world_record_global
			WHERE id_record = ANY(${sql.array([publicRecord, hiddenRecord])}::integer[])
		`
		const visibleZslLevels = await sql<{ id: number }[]>`
			SELECT id
			FROM public.zsl_level
			WHERE id = ANY(${sql.array([publicZslLevel.id, hiddenZslLevel.id])}::integer[])
		`
		const visibleZslResults = await sql<{ idLevel: number }[]>`
			SELECT id_level AS "idLevel"
			FROM public.zsl_level_result
			WHERE id_level = ANY(${sql.array([publicZslLevel.id, hiddenZslLevel.id])}::integer[])
		`
		const visibleMetadata = await sql<{ idLevel: number }[]>`
			SELECT id_level AS "idLevel"
			FROM public.level_metadata
			WHERE id_level = ANY(${sql.array(allFixtureLevelIds)}::integer[])
		`
		const hotFixtureLevels = await sql<{ id: number }[]>`
				SELECT id
				FROM public.hot_levels_since(now() - interval '1 day')
				WHERE id = ANY(${sql.array(allFixtureLevelIds)}::integer[])
			`
		const publicRandomTrack = await sql<{ idLevel: number }[]>`
				SELECT id_level AS "idLevel"
				FROM public.z_rtm(p_min_author_time => 91001, p_max_author_time => 91001)
			`
		const hiddenRandomTrack = await sql<{ idLevel: number }[]>`
				SELECT id_level AS "idLevel"
				FROM public.z_rtm(p_min_author_time => 91004, p_max_author_time => 91004)
			`
		await resetRole(sql)

		assertLength(visibleUnlisted, 1, 'Unlisted level after first record')
		assertEqual(
			visibleRecords.map((row) => row.id).sort(),
			[publicRecord, friendsRecord, hiddenRecord].sort(),
			'visible records',
		)
		assertEqual(
			visibleMedia.map((row) => row.idRecord).sort(),
			[publicRecord, hiddenRecord].sort(),
			'visible media',
		)
		assertEqual(
			visibleStatistics.map((row) => row.idRecord).sort(),
			[publicRecord, hiddenRecord].sort(),
			'visible statistics',
		)
		assertEqual(
			visiblePersonalBests.map((row) => row.idRecord).sort(),
			[publicRecord, hiddenRecord].sort(),
			'visible personal bests',
		)
		assertEqual(
			visibleWorldRecords.map((row) => row.idRecord).sort(),
			[publicRecord, hiddenRecord].sort(),
			'visible world records',
		)
		assertEqual(
			visibleZslLevels.map((row) => row.id).sort(),
			[publicZslLevel.id, hiddenZslLevel.id].sort(),
			'visible ZSL levels',
		)
		assertEqual(
			visibleZslResults.map((row) => row.idLevel).sort(),
			[publicZslLevel.id, hiddenZslLevel.id].sort(),
			'visible ZSL level results',
		)
		assertEqual(
			visibleMetadata.map((row) => row.idLevel).sort(),
			[
				levelIds.get('adventure'),
				levelIds.get('public'),
				levelIds.get('unlisted'),
				levelIds.get('aliases'),
			].sort(),
			'visible level metadata',
		)
		assertEqual(
			hotFixtureLevels.map((row) => row.id).sort(),
			[levelIds.get('public'), levelIds.get('unlisted')].sort(),
			'hot level visibility',
		)
		assertEqual(
			publicRandomTrack.map((row) => row.idLevel),
			[levelIds.get('public') as number],
			'zRtm public level visibility',
		)
		assertLength(hiddenRandomTrack, 0, 'zRtm hidden level visibility')

		await setGraphqlRole(sql)
		const visibleItems = await sql<{ id: number }[]>`
				SELECT id
				FROM public.level_item
				WHERE id = ANY(${sql.array(Object.values(itemIds))}::integer[])
			`
		const visibleWorkshops = await sql<{ workshopId: bigint }[]>`
				SELECT workshop_id AS "workshopId"
				FROM public.workshop_item
				WHERE workshop_id = ANY(${sql.array(
					[...workshopVisibility.keys()].map(String),
				)}::bigint[])
			`
		await resetRole(sql)
		assertEqual(
			visibleItems.map((row) => row.id).sort(),
			[
				itemIds.adventureHidden,
				itemIds.adventureDeleted,
				itemIds.public,
				itemIds.unlisted,
				itemIds.aliasPublic,
			].sort(),
			'level-item alias isolation',
		)
		assertEqual(
			visibleWorkshops.map((row) => row.workshopId).sort(),
			[
				-990000000000101n,
				-990000000000102n,
				-990000000000105n,
				-990000000000106n,
				-990000000000107n,
			].sort(),
			'Workshop visibility',
		)

		await sql`
			UPDATE public.workshop_item
			SET visibility = 2
			WHERE workshop_id = -990000000000101
		`
		await setGraphqlRole(sql)
		const metadataAfterHiddenTransition = await sql`
			SELECT id_level
			FROM public.level_metadata
			WHERE id_level = ${levelIds.get('public') as number}
		`
		const itemAfterHiddenTransition = await sql`
			SELECT id
			FROM public.level_item
			WHERE id = ${itemIds.public}
		`
		const recordAfterHiddenTransition = await sql`
			SELECT id
			FROM public.record
			WHERE id = ${publicRecord}
		`
		await resetRole(sql)
		assertLength(metadataAfterHiddenTransition, 0, 'metadata after Public to Hidden transition')
		assertLength(itemAfterHiddenTransition, 0, 'level item after Public to Hidden transition')
		assertLength(recordAfterHiddenTransition, 1, 'record after Public to Hidden transition')

		await sql`
			UPDATE public.workshop_item
			SET visibility = 0
			WHERE workshop_id = -990000000000101
		`

		await sql`DELETE FROM public.record WHERE id = ${firstUnlistedRecord}`
		await setGraphqlRole(sql)
		const visibleAfterNonFinalDelete = await sql`
				SELECT id FROM public.level_item WHERE id = ${itemIds.unlisted}
			`
		await resetRole(sql)
		assertLength(visibleAfterNonFinalDelete, 1, 'Unlisted level after non-final record')

		await sql`DELETE FROM public.record WHERE id = ${secondUnlistedRecord}`
		await setGraphqlRole(sql)
		const visibleAfterFinalDelete = await sql`
				SELECT id FROM public.level_item WHERE id = ${itemIds.unlisted}
			`
		await resetRole(sql)
		assertLength(
			visibleAfterFinalDelete,
			1,
			'Unlisted metadata remains public after final record',
		)
		const [stickyUnlistedLevel] = await sql<{ hasRecords: boolean }[]>`
			SELECT has_records AS "hasRecords"
			FROM public.level
			WHERE id = ${levelIds.get('unlisted') as number}
		`
		assertEqual(stickyUnlistedLevel?.hasRecords, true, 'sticky record history')

		await sql`DELETE FROM public.level_item WHERE id = ${itemIds.deletedOnly}`
		await sql`DELETE FROM public.workshop_item WHERE workshop_id = -990000000000105`
		await setGraphqlRole(sql)
		const trueOrphanAfterDelete = await sql`
				SELECT id FROM public.level WHERE id = ${levelIds.get('deleted-only') as number}
			`
		await resetRole(sql)
		assertLength(trueOrphanAfterDelete, 1, 'true orphan after item and Workshop deletion')
	} finally {
		await sql`ROLLBACK`
		await sql.end()
	}
}

if (import.meta.main) {
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) throw new Error('DATABASE_URL is required')
	await verifyGraphqlVisibility(databaseUrl)
	console.log('GraphQL visibility integration verification passed')
}
