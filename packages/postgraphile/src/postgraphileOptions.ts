import { PgAggregatesPreset } from '@graphile/pg-aggregates'
import { PgSimplifyInflectionPlugin } from '@graphile/simplify-inflection'
import { PgManyToManyPreset } from '@graphile-contrib/pg-many-to-many'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { postgraphile } from 'postgraphile'
import { makePgService } from 'postgraphile/adaptors/pg'
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { makeV4Preset } from 'postgraphile/presets/v4'
import { PostGraphileConnectionFilterPreset } from 'postgraphile-plugin-connection-filter'
import { AddCdnToUrlsPlugin } from './plugins/AddCdnToUrlsPlugin'
import { createBoundedGrafastCachesPlugin } from './plugins/BoundedGrafastCachesPlugin'
import PgFixForeignKeyNamesPlugin from './plugins/FixForeignKeyNamesPlugin'
import { HideAuthOrderByEnumsPlugin } from './plugins/HideAuthOrderByEnumsPlugin'
import { LiveQueryCompatPlugin } from './plugins/LiveQueryCompatPlugin'
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import OrderByRelatedInflectorsPlugin from './plugins/OrderByRelatedInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { withIgnoredMissingInflectors } from './plugins/pluginUtils'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'

type PostGraphileRuntimeConfig = {
	databaseUrl: string
	superuserDatabaseUrl?: string
	allowExplain: boolean
	nodeEnv: string
	databaseTimeouts: {
		connectMs: number
		statementMs: number
		lockMs: number
		idleTransactionMs: number
	}
	databasePoolMax: number
	cacheMaxEntries: number
	operationPlansPerOperation: number
	liveQueries: {
		enabled: boolean
	}
}

export function createPostGraphileV4Options(config: PostGraphileRuntimeConfig) {
	return {
		disableDefaultMutations: true,
		dynamicJson: false,
		extendedErrors: ['hint', 'detail', 'errcode'],
		ignoreRBAC: false,
		setofFunctionsContainNulls: false,
		simpleCollections: 'omit' as const,
		ignoreIndexes: true,
		allowExplain: config.allowExplain,
		watchPg: config.nodeEnv !== 'production',
		subscriptions: config.liveQueries.enabled,
		simpleSubscriptions: false,
		graphileBuildOptions: {
			connectionFilterRelations: true,
		},
	}
}

export function createPostGraphilePgServiceOptions(config: PostGraphileRuntimeConfig) {
	return {
		connectionString: config.databaseUrl,
		poolConfig: {
			application_name: 'zeepcentraal-postgraphile',
			max: config.databasePoolMax,
			connectionTimeoutMillis: config.databaseTimeouts.connectMs,
			statement_timeout: config.databaseTimeouts.statementMs,
			lock_timeout: config.databaseTimeouts.lockMs,
			idle_in_transaction_session_timeout: config.databaseTimeouts.idleTransactionMs,
		},
		...(config.nodeEnv !== 'production' && config.superuserDatabaseUrl
			? { superuserConnectionString: config.superuserDatabaseUrl }
			: {}),
		schemas: ['public'],
	}
}

const plugins: GraphileConfig.Plugin[] = [
	withIgnoredMissingInflectors(PgSimplifyInflectionPlugin, [
		'patchField',
		'updateByKeysField',
		'deleteByKeysField',
		'updateByKeysInputType',
		'deleteByKeysInputType',
		'updateNodeField',
		'deleteNodeField',
		'updateNodeInputType',
		'deleteNodeInputType',
	]),
	PgFixForeignKeyNamesPlugin,
	PgManyToManyInflectorsPlugin,
	OrderByRelatedInflectorsPlugin,
	TracePlugin,
	PaginationLimitsPlugin,
	AddCdnToUrlsPlugin,
	SkipByNodeIdFieldsPlugin,
	HideAuthOrderByEnumsPlugin,
	LiveQueryCompatPlugin,
]

export function createPostGraphilePreset(
	config: PostGraphileRuntimeConfig = postgraphileConfig,
): GraphileConfig.Preset {
	return {
		extends: [
			PostGraphileAmberPreset,
			makeV4Preset(createPostGraphileV4Options(config)),
			PostGraphileConnectionFilterPreset,
			PgManyToManyPreset,
			PgAggregatesPreset,
		],
		plugins: [
			...plugins,
			createBoundedGrafastCachesPlugin({
				maxEntries: config.cacheMaxEntries,
				operationPlansPerOperation: config.operationPlansPerOperation,
			}),
		],
		pgServices: [makePgService(createPostGraphilePgServiceOptions(config))],
		grafast: {
			explain: config.allowExplain,
		},
		schema: {
			pgSimplifyAllRows: true,
			pgSimplifyPatch: true,
			pgOmitListSuffix: false,
			pgShortPk: true,
		},
		grafserv: {
			graphqlPath: '/',
			graphiql: false,
			graphiqlPath: '/',
			graphiqlStaticPath: '/ruru-static/',
			graphqlOverGET: false,
			graphiqlOnGraphQLGET: false,
			watch: config.nodeEnv !== 'production',
			websockets: config.liveQueries.enabled,
			parseAndValidateCacheSize: config.cacheMaxEntries,
		},
	}
}

export const createPostGraphileOptions = createPostGraphilePreset

export function createPostGraphileHandler(config = postgraphileConfig) {
	return postgraphile(createPostGraphilePreset(config))
}
