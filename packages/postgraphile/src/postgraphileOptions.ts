import PgAggregatesPlugin from '@graphile/pg-aggregates'
import SubscriptionsLdsPlugin from '@graphile/subscriptions-lds'
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many'
import PgOrderByRelatedPlugin from '@graphile-contrib/pg-order-by-related'
import PgSimplifyInflectorPlugin from '@graphile-contrib/pg-simplify-inflector'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { type PostGraphileOptions, postgraphile } from 'postgraphile'
import ConnectionFilterPlugin from 'postgraphile-plugin-connection-filter'
import { AddCdnToUrlsPlugin } from './plugins/AddCdnToUrlsPlugin'
import PgFixForeignKeyNamesPlugin from './plugins/FixForeignKeyNamesPlugin'
import { HideAuthOrderByEnumsPlugin } from './plugins/HideAuthOrderByEnumsPlugin'
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import OrderByRelatedInflectorsPlugin from './plugins/OrderByRelatedInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'

type PostGraphileRuntimeConfig = {
	databaseUrl: string
	allowExplain: boolean
}

const plugins = [
	ConnectionFilterPlugin,
	PgFixForeignKeyNamesPlugin,
	PgSimplifyInflectorPlugin,
	PgManyToManyPlugin,
	PgManyToManyInflectorsPlugin,
	PgOrderByRelatedPlugin,
	OrderByRelatedInflectorsPlugin,
	SubscriptionsLdsPlugin,
	PgAggregatesPlugin,
	TracePlugin,
	PaginationLimitsPlugin,
	AddCdnToUrlsPlugin,
	SkipByNodeIdFieldsPlugin,
	HideAuthOrderByEnumsPlugin,
]

export function createPostGraphileOptions(
	config: PostGraphileRuntimeConfig = postgraphileConfig,
): PostGraphileOptions {
	return {
		appendPlugins: plugins,
		live: true,
		websockets: [],
		ownerConnectionString: config.databaseUrl,
		retryOnInitFail: true,
		watchPg: true,
		graphiql: false,
		enhanceGraphiql: false,
		graphqlRoute: '/',
		disableDefaultMutations: true,
		dynamicJson: false,
		extendedErrors: ['hint', 'detail', 'errcode'],
		sortExport: true,
		enableQueryBatching: true,
		ignoreRBAC: true,
		setofFunctionsContainNulls: false,
		legacyRelations: 'omit',
		simpleCollections: 'omit',
		enableCors: true,
		ignoreIndexes: true,
		allowExplain: config.allowExplain,
		graphileBuildOptions: {
			connectionFilterRelations: true,
			connectionFilterUseListInflectors: false,
			orderByRelatedColumnAggregates: true,
			pgSimplifyAllRows: true,
			pgSimplifyPatch: true,
			pgOmitListSuffix: false,
			pgShortPk: true,
		},
	}
}

export function createPostGraphileHandler(config = postgraphileConfig) {
	return postgraphile(config.databaseUrl, 'public', createPostGraphileOptions(config))
}
