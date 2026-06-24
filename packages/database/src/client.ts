import { databaseConfig } from '@zeepkist/core/config/database'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const client = postgres(databaseConfig.databaseUrl, {
	max: 10,
	idle_timeout: 30,
})

export const db = drizzle(client, { schema })

export async function closeDatabase(): Promise<void> {
	await client.end({ timeout: 5 })
}
