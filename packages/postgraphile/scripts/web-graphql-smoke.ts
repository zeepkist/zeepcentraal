import { fileURLToPath } from 'node:url'
import { parse, validate } from 'postgraphile/graphql'
import type { OperationCatalog, SmokeCliOptions } from './utils/webGraphqlSmoke'
import {
	GraphqlSmokeError,
	loadEndpointSchema,
	loadOperationCatalog,
	loadPublishedSchema,
	parseSmokeCliArguments,
	printOperation,
	requestGraphql,
	requireObjectAtPath,
	requireScalar,
	validateOperationCatalog,
	ZRTM_RLS_SMOKE_QUERY,
} from './utils/webGraphqlSmoke'

const webGraphqlDirectory = fileURLToPath(new URL('../../graphql/documents/web', import.meta.url))
const publishedSchemaPath = fileURLToPath(new URL('../../graphql/schema.graphql', import.meta.url))

interface SmokeLogger {
	error(message: string): void
	log(message: string): void
}

interface RunSmokeOptions extends SmokeCliOptions {
	catalog?: OperationCatalog
	fetchImpl?: typeof fetch
	logger?: SmokeLogger
	now?: Date
}

interface PublicRecordSeed {
	levelId: number
	recordId: number
	steamId: string
	userId: number
	xxHash: string
}

interface PublicZslSeed {
	round: number
	seasonId: number
	zslLevelId?: number
}

export async function runWebGraphqlSmoke({
	catalog: suppliedCatalog,
	endpoint,
	fetchImpl = fetch,
	logger = console,
	now = new Date(),
	production,
	schemaOnly,
	timeoutMs,
}: RunSmokeOptions): Promise<void> {
	const catalog = suppliedCatalog ?? (await loadOperationCatalog(webGraphqlDirectory))
	const publishedSchema = await loadPublishedSchema(publishedSchemaPath)
	assertValidCatalog(publishedSchema, catalog, 'published schema')
	assertValidZrtmSmoke(publishedSchema, 'published schema')
	logger.log(`✓ ${catalog.operations.size} web operations validate against published schema`)

	const endpointSchema = await loadEndpointSchema({ endpoint, fetchImpl, timeoutMs })
	assertValidCatalog(endpointSchema.schema, catalog, 'endpoint schema')
	assertValidZrtmSmoke(endpointSchema.schema, 'endpoint schema')
	logger.log(
		`✓ ${catalog.operations.size} web operations validate against endpoint schema (${endpointSchema.durationMs}ms)`,
	)

	if (schemaOnly) return

	logger.log(`Running ${production ? 'production' : 'local'} RLS smoke operations sequentially`)
	const executeQuery = async (
		operationName: string,
		query: string,
		variables?: Record<string, unknown>,
	) => {
		const result = await requestGraphql({
			endpoint,
			fetchImpl,
			operationName,
			query,
			timeoutMs,
			variables,
		})
		const cost = result.queryCost ? `, cost ${result.queryCost}` : ''
		logger.log(`✓ ${operationName} (${result.durationMs}ms${cost})`)
		return result.data
	}
	const execute = (operationName: string, variables?: Record<string, unknown>) =>
		executeQuery(operationName, printOperation(catalog, operationName), variables)

	const windows = smokeTimeWindows(now)
	const metricWindows = { daySince: windows.daySince, monthSince: windows.monthSince }
	const recordHistory = await execute('ZC_RecordHistory', {
		filter: { historyView: { equalTo: 'recent' } },
		first: 1,
		orderBy: ['DATE_CREATED_DESC', 'ID_DESC'],
	})
	const record = readRecordSeed(recordHistory)

	await execute('ZC_Levels', {
		filter: { and: [{ publiclyVisible: { equalTo: true } }] },
		first: 24,
		orderBy: ['LEVEL_POINTS_POINTS_DESC'],
	})
	await execute('ZC_Users', { first: 1, orderBy: ['RANK_ASC', 'USER_ID_ASC'] })
	await execute('ZC_OmniSearch', { search: 'ze' })
	await execute('ZC_DashboardCritical', metricWindows)
	await execute('ZC_DashboardHotLevels', { since: windows.monthSince })
	await executeQuery('ZC_RlsZrtmSmoke', ZRTM_RLS_SMOKE_QUERY)
	await execute('ZC_DashboardStatistics', {
		...metricWindows,
		minimumModVersion: '1.2.0',
	})
	await execute('ZC_AdventureSeriesCounts')
	await execute('ZC_AdventureSeries', { prefix: 'A-' })

	const levelDetail = await execute('ZC_LevelDetail', { xxHash: record.xxHash })
	requireObjectAtPath(levelDetail, ['levelByXxHash'])
	const recordDetail = await execute('ZC_RecordDetail', { recordId: record.recordId })
	const recordNode = requireObjectAtPath(recordDetail, ['record'])
	requireObjectAtPath(recordNode, ['level'])
	requireObjectAtPath(recordNode, ['user'])
	const userProfile = await execute('ZC_UserProfile', { steamId: record.steamId })
	requireFirstNode(userProfile, ['users'])
	await execute('ZC_LevelStatistics', {
		levelId: record.levelId,
		minimumModVersion: '1.2.0',
	})
	await execute('ZC_UserStatistics', {
		...metricWindows,
		minimumModVersion: '1.2.0',
		userId: record.userId,
		yearSince: windows.yearSince,
	})

	const zslSeasons = await execute('ZC_ZslSeasons', { first: 1 })
	const zsl = readZslSeed(zslSeasons)
	await execute('ZC_ZslSeason', { id: zsl.seasonId })
	const round = await execute('ZC_ZslRoundBySeasonAndNumber', {
		round: zsl.round,
		seasonId: zsl.seasonId,
	})
	zsl.zslLevelId = readOptionalZslLevelId(round)
	await execute('ZC_ZslSeasonResults', {
		first: 1,
		id: zsl.seasonId,
		includeViewer: false,
		viewerId: 0,
	})
	await execute('ZC_ZslRoundResults', {
		first: 1,
		includeViewer: false,
		round: zsl.round,
		seasonId: zsl.seasonId,
		viewerId: 0,
	})
	if (zsl.zslLevelId !== undefined) {
		await execute('ZC_ZslLevel', { id: zsl.zslLevelId })
		await execute('ZC_ZslLevelResults', {
			first: 1,
			id: zsl.zslLevelId,
			includeViewer: false,
			viewerId: 0,
		})
	}
}

export async function main(arguments_ = process.argv.slice(2), logger: SmokeLogger = console) {
	try {
		await runWebGraphqlSmoke({ ...parseSmokeCliArguments(arguments_), logger })
		logger.log('GraphQL RLS smoke passed')
		return 0
	} catch (error) {
		logger.error(error instanceof Error ? error.message : 'GraphQL RLS smoke failed')
		return 1
	}
}

function assertValidCatalog(
	schema: Parameters<typeof validateOperationCatalog>[0],
	catalog: OperationCatalog,
	label: string,
): void {
	const failures = validateOperationCatalog(schema, catalog)
	if (failures.length > 0) {
		throw new GraphqlSmokeError(
			`${failures.length} web operations do not validate against ${label}:\n${failures.join('\n')}`,
		)
	}
}

function assertValidZrtmSmoke(
	schema: Parameters<typeof validateOperationCatalog>[0],
	label: string,
): void {
	const failures = validate(schema, parse(ZRTM_RLS_SMOKE_QUERY))
	if (failures.length > 0) {
		throw new GraphqlSmokeError(
			`ZC_RlsZrtmSmoke does not validate against ${label}: ${failures
				.map((error) => error.message)
				.join('; ')}`,
		)
	}
}

function smokeTimeWindows(now: Date) {
	return {
		daySince: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
		monthSince: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
		yearSince: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(),
	}
}

function readRecordSeed(data: unknown): PublicRecordSeed {
	const node = requireFirstEdgeNode(data, ['recordHistoryEntries'])
	return {
		levelId: requireScalar(node, 'levelId', 'number') as number,
		recordId: requireScalar(node, 'id', 'number') as number,
		steamId: requireScalar(node, 'userSteamId', 'string') as string,
		userId: requireScalar(node, 'userId', 'number') as number,
		xxHash: requireScalar(node, 'levelXxHash', 'string') as string,
	}
}

function readZslSeed(data: unknown): PublicZslSeed {
	const season = requireFirstEdgeNode(data, ['zslSeasons'])
	const round = requireFirstNode(season, ['zslRounds'])
	return {
		round: requireScalar(round, 'round', 'number') as number,
		seasonId: requireScalar(season, 'id', 'number') as number,
	}
}

function readOptionalZslLevelId(data: unknown): number | undefined {
	const rounds = requireObjectAtPath(data, ['zslRounds'])
	const nodes = rounds.nodes
	if (!Array.isArray(nodes) || nodes.length === 0 || typeof nodes[0] !== 'object' || !nodes[0]) {
		return undefined
	}
	const level = requireFirstNode(nodes[0], ['zslLevels'])
	return requireScalar(level, 'id', 'number') as number
}

function requireFirstEdgeNode(data: unknown, path: string[]): Record<string, unknown> {
	const connection = requireObjectAtPath(data, path)
	const edges = connection.edges
	if (!Array.isArray(edges) || edges.length === 0 || typeof edges[0] !== 'object' || !edges[0]) {
		throw new GraphqlSmokeError(`Missing public seed ${path.join('.')}.edges`)
	}
	return requireObjectAtPath(edges[0], ['node'])
}

function requireFirstNode(data: unknown, path: string[]): Record<string, unknown> {
	const connection = requireObjectAtPath(data, path)
	const nodes = connection.nodes
	if (!Array.isArray(nodes) || nodes.length === 0 || typeof nodes[0] !== 'object' || !nodes[0]) {
		throw new GraphqlSmokeError(`Missing public seed ${path.join('.')}.nodes`)
	}
	return nodes[0] as Record<string, unknown>
}

if (import.meta.main) {
	process.exitCode = await main()
}
