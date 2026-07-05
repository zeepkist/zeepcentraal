import PgAggregatesPlugin from '@graphile/pg-aggregates'
import SubscriptionsLdsPlugin from '@graphile/subscriptions-lds'
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many'
import PgOrderByRelatedPlugin from '@graphile-contrib/pg-order-by-related'
import PgSimplifyInflectorPlugin from '@graphile-contrib/pg-simplify-inflector'
import bodyParser from '@koa/bodyparser'
import cors from '@koa/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { startNodeTelemetry, stopNodeTelemetry } from '@zeepkist/telemetry'
import Koa from 'koa'
import logger from 'koa-morgan'
import { postgraphile } from 'postgraphile'
import ConnectionFilterPlugin from 'postgraphile-plugin-connection-filter'
import { collectHeaderMetrics } from './middleware/collectHeaderMetrics'
import { createQueryCostMiddleware } from './middleware/createQueryCostMiddleware'
import { serveGraphiql } from './middleware/serveGraphiql'
import { AddCdnToUrlsPlugin } from './plugins/AddCdnToUrlsPlugin'
import PgFixForeignKeyNamesPlugin from './plugins/FixForeignKeyNamesPlugin'
import { HideAuthOrderByEnumsPlugin } from './plugins/HideAuthOrderByEnumsPlugin'
import PgManyToManyInflectorsPlugin from './plugins/ManyToManyInflectorsPlugin'
import OrderByRelatedInflectorsPlugin from './plugins/OrderByRelatedInflectorsPlugin'
import { PaginationLimitsPlugin } from './plugins/PaginationLimitsPlugin'
import { SkipByNodeIdFieldsPlugin } from './plugins/SkipByNodeIdFieldsPlugin'
import { TracePlugin } from './plugins/TracePlugin'

startNodeTelemetry({
	packageName: 'postgraphile',
	collectorUrl: postgraphileConfig.otel.collectorUrl,
	nodeEnv: postgraphileConfig.nodeEnv,
	serviceName: postgraphileConfig.otel.serviceName,
	serviceVersion: postgraphileConfig.otel.serviceVersion,
})

const app = new Koa()
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

app.use(collectHeaderMetrics)
app.use(cors())

if (postgraphileConfig.requestLogging) {
	app.use(logger('dev'))
}

app.use(async (ctx, next) => {
	if (ctx.path === '/healthz' && (ctx.method === 'HEAD' || ctx.method === 'GET')) {
		ctx.status = 200
		ctx.body = 'OK'
		return
	}

	await next()
})

app.use(serveGraphiql)

app.use(async (ctx, next) => {
	if (ctx.path === '/graphiql' && ctx.method === 'GET') {
		ctx.redirect('/')
		return
	}

	await next()
})

app.use(
	bodyParser({
		enableTypes: ['json', 'text'],
		extendTypes: {
			text: ['graphql', 'graphqls'],
		},
	}),
)

app.use(
	createQueryCostMiddleware(
		postgraphileConfig.maxQueryCost,
		postgraphileConfig.defaultCollectionSize,
		postgraphileConfig.queryTraceDetail,
	),
)

app.use(
	postgraphile(postgraphileConfig.databaseUrl, 'public', {
		appendPlugins: plugins,
		live: true,
		ownerConnectionString: postgraphileConfig.databaseUrl,
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
		allowExplain: postgraphileConfig.allowExplain,
		graphileBuildOptions: {
			connectionFilterRelations: true,
			connectionFilterUseListInflectors: false,
			orderByRelatedColumnAggregates: true,
			pgSimplifyAllRows: true,
			pgSimplifyPatch: true,
			pgOmitListSuffix: false,
			pgShortPk: true,
		},
	}),
)

const server = app.listen(postgraphileConfig.port, postgraphileConfig.host, () => {
	console.log(
		`PostGraphile running at http://${postgraphileConfig.host}:${postgraphileConfig.port}/graphiql`,
	)
})

async function shutdown() {
	server.close()
	await stopNodeTelemetry()
	process.exit(0)
}

process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
