import { createSqlClient } from '@zeepkist/core/sql'
import type { ReservedSQL, SQL } from 'bun'
import type {
	PgAdaptor,
	PgClient,
	PgClientQuery,
	PgClientResult,
	WithPgClient,
} from 'postgraphile/@dataplan/pg'
import type { GrafastSubscriber } from 'postgraphile/grafast'
import { BunSqlSubscriber } from './bunSqlSubscriber'

const ADAPTOR_NAME = 'zeepcentraal/bun-sql' as const

type PoolOptions = {
	application_name?: string
	max: number
	connectionTimeoutMillis: number
	statement_timeout: number
	lock_timeout: number
	idle_in_transaction_session_timeout: number
}

type ServiceOptions = {
	connectionString: string
	poolConfig: PoolOptions
	superuserConnectionString?: string
	schemas: string[]
	pubsub?: boolean
}

type AdaptorSettings = { pool: SQL; superuserPool?: SQL }

declare global {
	namespace Grafast {
		interface Context {
			bunPgSettings: Record<string, string | undefined> | null
			bunPgSubscriber: GrafastSubscriber | null
			bunWithPgClient: WithPgClient<BunPgClient>
		}
	}
	namespace GraphileConfig {
		interface PgAdaptors {
			'zeepcentraal/bun-sql': {
				adaptorSettings: AdaptorSettings
				makePgServiceOptions: ServiceOptions
				client: BunPgClient
			}
		}
	}
}

/** Preserve GraphQL's PostgreSQL diagnostic contract without mutating native errors. */
export function normalizeBunSqlError(error: unknown): unknown {
	if (!(error instanceof Error)) return error
	const errno = Reflect.get(error, 'errno')
	if (typeof errno !== 'string' || !/^[0-9A-Z]{5}$/.test(errno)) return error
	const normalized = new Error(error.message, { cause: error })
	for (const key of [
		'severity',
		'detail',
		'hint',
		'position',
		'internalPosition',
		'internalQuery',
		'where',
		'schema',
		'table',
		'column',
		'dataType',
		'constraint',
		'file',
		'line',
		'routine',
	]) {
		const value = Reflect.get(error, key)
		if (value !== undefined) Reflect.set(normalized, key, value)
	}
	Reflect.set(normalized, 'code', errno)
	return normalized
}

/** One wrapper per transaction depth; sibling operations queue behind transactions. */
export class BunPgClient implements PgClient {
	private queue: Promise<void> | undefined

	constructor(
		private readonly sql: ReservedSQL,
		private readonly depth = 0,
	) {}

	private enqueue<T>(work: () => Promise<T>): Promise<T> {
		const result = this.queue ? this.queue.then(work) : work()
		const tail = result.then(
			() => {},
			() => {},
		)
		this.queue = tail
		void tail.then(() => {
			if (this.queue === tail) this.queue = undefined
		})
		return result
	}

	async waitForIdle(): Promise<void> {
		await this.queue
	}

	query<TData>({ text, values, arrayMode }: PgClientQuery): Promise<PgClientResult<TData>> {
		return this.enqueue(async () => {
			try {
				const query = this.sql.unsafe(text, values ?? [])
				const rows = await (arrayMode ? query.values() : query)
				return { rows: rows as TData[], rowCount: rows.count ?? null }
			} catch (error) {
				throw normalizeBunSqlError(error)
			}
		})
	}

	withTransaction<T>(callback: (client: this) => Promise<T>): Promise<T> {
		return this.enqueue(async () => {
			const nested = this.depth > 0
			const savepoint = `bun_tx_${this.depth}`
			const execute = (text: string) => this.sql.unsafe(text)
			try {
				await execute(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN')
				const client = new BunPgClient(this.sql, this.depth + 1) as this
				try {
					let result: T
					try {
						result = await callback(client)
					} finally {
						await client.waitForIdle()
					}
					await execute(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT')
					return result
				} catch (error) {
					try {
						await execute(nested ? `ROLLBACK TO SAVEPOINT ${savepoint}` : 'ROLLBACK')
					} catch {
						// Never return a connection with an unknown transaction state to the pool.
						await this.sql.close().catch(() => {})
					}
					throw error
				}
			} catch (error) {
				throw normalizeBunSqlError(error)
			}
		})
	}
}

export const bunSqlAdaptor: PgAdaptor<typeof ADAPTOR_NAME> = {
	createWithPgClient({ pool, superuserPool }, variant) {
		const selected = variant === 'SUPERUSER' ? (superuserPool ?? pool) : pool
		const withClient: WithPgClient<BunPgClient> = async (settings, callback) => {
			const reserved = await selected.reserve()
			const client = new BunPgClient(reserved)
			try {
				const entries = Object.entries(settings ?? {}).filter(
					(entry) => entry[1] !== undefined,
				)
				if (entries.length === 0) return await callback(client)
				return await client.withTransaction(async (transaction) => {
					await transaction.query({
						text: 'select set_config(el->>0, el->>1, true) from json_array_elements($1::json) el',
						values: [JSON.stringify(entries)],
					})
					return await callback(transaction)
				})
			} finally {
				await client.waitForIdle()
				reserved.release()
			}
		}
		// Pools belong to the service, not the temporary introspection/client wrapper.
		return withClient
	},
	makePgService: makeBunPgService,
}

export function makeBunPgService(
	options: ServiceOptions,
): GraphileConfig.PgServiceConfiguration<typeof ADAPTOR_NAME> {
	const { poolConfig, pubsub = true } = options
	if (pubsub && poolConfig.max < 2) {
		throw new Error('PostGraphile Bun SQL requires pool max >= 2 for queries and LISTEN/NOTIFY')
	}
	const connection = {
		application_name: poolConfig.application_name ?? 'zeepcentraal-postgraphile',
		statement_timeout: poolConfig.statement_timeout,
		lock_timeout: poolConfig.lock_timeout,
		idle_in_transaction_session_timeout: poolConfig.idle_in_transaction_session_timeout,
		...(process.env.DATAPLAN_PG_DONT_DISABLE_JIT !== '1' && { jit_optimize_above_cost: -1 }),
	}
	const pool = createSqlClient(options.connectionString, {
		max: poolConfig.max - (pubsub ? 1 : 0),
		// Grafast passes pre-serialized JSON parameters, matching pg text encoding.
		prepare: false,
		idleTimeout: 10,
		connectionTimeout: poolConfig.connectionTimeoutMillis / 1000,
		connection,
	})
	const superuserPool = options.superuserConnectionString
		? createSqlClient(options.superuserConnectionString, {
				max: 1,
				prepare: false,
				connectionTimeout: poolConfig.connectionTimeoutMillis / 1000,
			})
		: undefined
	const subscriber = pubsub ? new BunSqlSubscriber(pool) : null
	let closing: Promise<void> | undefined
	return {
		name: 'main',
		schemas: options.schemas,
		withPgClientKey: 'bunWithPgClient',
		pgSettingsKey: 'bunPgSettings',
		pgSubscriberKey: 'bunPgSubscriber',
		pgSubscriber: subscriber,
		adaptor: bunSqlAdaptor,
		adaptorSettings: { pool, superuserPool },
		release() {
			closing ??= (async () => {
				try {
					await subscriber?.release()
				} finally {
					await Promise.all([
						pool.close({ timeout: 5 }),
						superuserPool?.close({ timeout: 5 }),
					])
				}
			})()
			return closing
		},
	}
}
