import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function getDatabaseUrl() {
	return process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zeepkist'
}

export const client = postgres(getDatabaseUrl(), {
	max: 10,
	idle_timeout: 30,
})

export const db = drizzle(client, { schema })

export async function closeDatabase(): Promise<void> {
	await client.end({ timeout: 5 })
}
