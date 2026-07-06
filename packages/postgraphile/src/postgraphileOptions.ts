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
import PgFixForeignKeyNamesPlugin from './plugins/FixForeignKeyNamesPlugin'
import { HideAuthOrderByEnumsPlugin } from './plugins/HideAuthOrderByEnumsPlugin'
import { LiveQueryCompatPlugin } from './plugins/LiveQueryCompatPlugin'
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { withIgnoredMissingInflectors } from './plugins/pluginUtils'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'

type PostGraphileRuntimeConfig = {
	databaseUrl: string
	allowExplain: boolean
	nodeEnv: string
	liveQueries: {
		enabled: boolean
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
			makeV4Preset({
				disableDefaultMutations: true,
				dynamicJson: false,
				extendedErrors: ['hint', 'detail', 'errcode'],
				ignoreRBAC: true,
				setofFunctionsContainNulls: false,
				simpleCollections: 'omit',
				ignoreIndexes: true,
				allowExplain: config.allowExplain,
				watchPg: config.nodeEnv !== 'production',
				subscriptions: config.liveQueries.enabled,
				simpleSubscriptions: false,
				graphileBuildOptions: {
					connectionFilterRelations: true,
				},
			}),
			PostGraphileConnectionFilterPreset,
			PgManyToManyPreset,
			PgAggregatesPreset,
		],
		plugins,
		pgServices: [
			makePgService({
				connectionString: config.databaseUrl,
				superuserConnectionString: config.databaseUrl,
				schemas: ['public'],
			}),
		],
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
		},
	}
}

export const createPostGraphileOptions = createPostGraphilePreset

export function createPostGraphileHandler(config = postgraphileConfig) {
	return postgraphile(createPostGraphilePreset(config))
}
