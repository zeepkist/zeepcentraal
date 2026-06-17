import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function getDatabaseUrl() {
	return process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/zeepkist'
}

const client = postgres(getDatabaseUrl(), {
	max: 20,
	idle_timeout: 30,
})

export const db = drizzle(client, { schema })

export * from './services'
export { schema }
