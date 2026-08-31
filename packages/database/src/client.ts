import { databaseConfig } from '@zeepkist/core/config/database'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createDatabaseClientOptions } from './clientOptions'
import * as schema from './schema'
import { createTracedPostgresClient } from './telemetry'

const rawClient = postgres(databaseConfig.databaseUrl, createDatabaseClientOptions(databaseConfig))
export const client = createTracedPostgresClient(rawClient, databaseConfig.databaseUrl)

export const db = drizzle(client, { schema })

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DatabaseExecutor = typeof db | DatabaseTransaction

export async function closeDatabase(): Promise<void> {
	await client.end({ timeout: 5 })
}

export const databaseHandle: AsyncDisposable = {
	[Symbol.asyncDispose]: closeDatabase,
}
