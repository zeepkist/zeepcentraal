import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const postgraphileEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	POSTGRAPHILE_DATABASE_URL: z.string().min(1).optional(),
	DATABASE_URL: z.string().min(1).optional(),
	POSTGRAPHILE_SUPERUSER_DATABASE_URL: z.string().min(1).optional(),
	DB_USERNAME: z.string().min(1).optional(),
	DB_PASSWORD: z.string().optional(),
	DB_HOST: z.string().min(1).optional(),
	DB_PORT: z.coerce.number().int().positive().optional(),
	DB_DATABASE: z.string().min(1).optional(),
	POSTGRAPHILE_HOST: z.string().default('0.0.0.0'),
	POSTGRAPHILE_PORT: z.coerce.number().int().positive().default(5000),
	POSTGRAPHILE_REQUEST_LOGGING: z.stringbool().default(false),
	POSTGRAPHILE_DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
	POSTGRAPHILE_DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
	POSTGRAPHILE_DATABASE_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
	POSTGRAPHILE_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(30000),
	POSTGRAPHILE_DATABASE_POOL_MAX: z.coerce.number().int().positive().default(6),
	POSTGRAPHILE_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(128),
	POSTGRAPHILE_OPERATION_PLANS_PER_OPERATION: z.coerce.number().int().positive().default(8),
	POSTGRAPHILE_READINESS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
	POSTGRAPHILE_READINESS_CACHE_MS: z.coerce.number().int().nonnegative().default(1000),
	GRAPHQL_FIELD_TRACING: z.stringbool().default(false),
	GRAPHQL_QUERY_TRACE_DETAIL: z.stringbool().default(false),
	GRAPHQL_MAX_QUERY_COST: z.coerce.number().int().positive().default(5000),
	GRAPHQL_DEFAULT_COLLECTION_SIZE: z.coerce.number().int().positive().default(100),
	POSTGRAPHILE_LIVE_QUERIES: z.stringbool().default(true),
	POSTGRAPHILE_LIVE_QUERY_POLL_MS: z.coerce.number().int().positive().default(250),
	POSTGRAPHILE_LIVE_QUERY_DEBOUNCE_MS: z.coerce.number().int().positive().default(100),
	POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS: z.coerce.number().int().positive().default(512),
	POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS_PER_CONNECTION: z.coerce
		.number()
		.int()
		.positive()
		.default(16),
	POSTGRAPHILE_LIVE_QUERY_MAX_CONCURRENT_EXECUTIONS: z.coerce
		.number()
		.int()
		.positive()
		.default(4),
	POSTGRAPHILE_LIVE_QUERY_INVALIDATION_RETENTION_MINUTES: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CDN_BASE_URL: z.string().optional(),
	DEBUG: z.string().optional(),
	OPENTELEMETRY_SERVICE_NAME: z.string().optional(),
	OPENTELEMETRY_SERVICE_VERSION: z.string().optional(),
	OPENTELEMETRY_COLLECTOR_URL: z.string().default('http://localhost:4317'),
})

function resolveDatabaseUrl(env: z.infer<typeof postgraphileEnvSchema>): string {
	if (env.POSTGRAPHILE_DATABASE_URL) {
		return env.POSTGRAPHILE_DATABASE_URL
	}

	if (env.DATABASE_URL) {
		return env.DATABASE_URL
	}

	if (env.DB_USERNAME && env.DB_HOST && env.DB_PORT && env.DB_DATABASE) {
		const password = env.DB_PASSWORD ?? ''
		return `postgres://${env.DB_USERNAME}:${password}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_DATABASE}`
	}

	return 'postgres://postgres:postgres@localhost:5432/zeepkist'
}

export function parsePostgraphileConfig(env: EnvSource) {
	const parsedEnv = postgraphileEnvSchema.parse(env)
	if (
		parsedEnv.NODE_ENV === 'production' &&
		parsedEnv.POSTGRAPHILE_SUPERUSER_DATABASE_URL !== undefined
	) {
		throw new Error('POSTGRAPHILE_SUPERUSER_DATABASE_URL is forbidden in production')
	}

	return {
		nodeEnv: parsedEnv.NODE_ENV,
		host: parsedEnv.POSTGRAPHILE_HOST,
		port: parsedEnv.POSTGRAPHILE_PORT,
		databaseUrl: resolveDatabaseUrl(parsedEnv),
		superuserDatabaseUrl: parsedEnv.POSTGRAPHILE_SUPERUSER_DATABASE_URL,
		requestLogging: parsedEnv.POSTGRAPHILE_REQUEST_LOGGING,
		databaseTimeouts: {
			connectMs: parsedEnv.POSTGRAPHILE_DATABASE_CONNECT_TIMEOUT_MS,
			statementMs: parsedEnv.POSTGRAPHILE_DATABASE_STATEMENT_TIMEOUT_MS,
			lockMs: parsedEnv.POSTGRAPHILE_DATABASE_LOCK_TIMEOUT_MS,
			idleTransactionMs: parsedEnv.POSTGRAPHILE_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS,
		},
		databasePoolMax: parsedEnv.POSTGRAPHILE_DATABASE_POOL_MAX,
		cacheMaxEntries: parsedEnv.POSTGRAPHILE_CACHE_MAX_ENTRIES,
		operationPlansPerOperation: parsedEnv.POSTGRAPHILE_OPERATION_PLANS_PER_OPERATION,
		readiness: {
			timeoutMs: parsedEnv.POSTGRAPHILE_READINESS_TIMEOUT_MS,
			cacheMs: parsedEnv.POSTGRAPHILE_READINESS_CACHE_MS,
		},
		fieldTracing: parsedEnv.GRAPHQL_FIELD_TRACING,
		queryTraceDetail: parsedEnv.GRAPHQL_QUERY_TRACE_DETAIL,
		maxQueryCost: parsedEnv.GRAPHQL_MAX_QUERY_COST,
		defaultCollectionSize: parsedEnv.GRAPHQL_DEFAULT_COLLECTION_SIZE,
		liveQueries: {
			enabled: parsedEnv.POSTGRAPHILE_LIVE_QUERIES,
			pollMs: parsedEnv.POSTGRAPHILE_LIVE_QUERY_POLL_MS,
			debounceMs: parsedEnv.POSTGRAPHILE_LIVE_QUERY_DEBOUNCE_MS,
			maxOperations: parsedEnv.POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS,
			maxOperationsPerConnection:
				parsedEnv.POSTGRAPHILE_LIVE_QUERY_MAX_OPERATIONS_PER_CONNECTION,
			maxConcurrentExecutions: parsedEnv.POSTGRAPHILE_LIVE_QUERY_MAX_CONCURRENT_EXECUTIONS,
			invalidationRetentionMinutes:
				parsedEnv.POSTGRAPHILE_LIVE_QUERY_INVALIDATION_RETENTION_MINUTES,
		},
		cdnBaseUrl: parsedEnv.CDN_BASE_URL,
		allowExplain: Boolean(parsedEnv.DEBUG),
		otel: {
			serviceName: parsedEnv.OPENTELEMETRY_SERVICE_NAME,
			serviceVersion: parsedEnv.OPENTELEMETRY_SERVICE_VERSION,
			collectorUrl: parsedEnv.OPENTELEMETRY_COLLECTOR_URL,
		},
	} as const
}

export const postgraphileConfig = parsePostgraphileConfig(process.env)
