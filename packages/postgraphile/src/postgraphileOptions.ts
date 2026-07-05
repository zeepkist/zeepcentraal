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
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'

type PostGraphileRuntimeConfig = {
	databaseUrl: string
	allowExplain: boolean
	nodeEnv: string
}

const plugins: GraphileConfig.Plugin[] = [
	{
		...PgSimplifyInflectionPlugin,
		inflection: {
			...PgSimplifyInflectionPlugin.inflection,
			ignoreReplaceIfNotExists: [
				...(PgSimplifyInflectionPlugin.inflection?.ignoreReplaceIfNotExists ?? []),
				'patchField',
				'updateByKeysField',
				'deleteByKeysField',
				'updateByKeysInputType',
				'deleteByKeysInputType',
				'updateNodeField',
				'deleteNodeField',
				'updateNodeInputType',
				'deleteNodeInputType',
			],
		},
	},
	PgFixForeignKeyNamesPlugin,
	PgManyToManyInflectorsPlugin,
	TracePlugin,
	PaginationLimitsPlugin,
	AddCdnToUrlsPlugin,
	SkipByNodeIdFieldsPlugin,
	HideAuthOrderByEnumsPlugin,
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
				subscriptions: true,
				simpleSubscriptions: true,
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
			eventStreamPath: '/stream',
			graphiql: false,
			graphiqlPath: '/',
			graphiqlStaticPath: '/ruru-static/',
			graphqlOverGET: false,
			graphiqlOnGraphQLGET: false,
			watch: config.nodeEnv !== 'production',
			websockets: true,
		},
	}
}

export const createPostGraphileOptions = createPostGraphilePreset

export function createPostGraphileHandler(config = postgraphileConfig) {
	return postgraphile(createPostGraphilePreset(config))
}
