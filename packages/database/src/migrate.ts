import { migrateConfig } from '@zeepkist/core/config'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'

async function main() {
	const migrationsFolder = migrateConfig.migrationsFolder
	console.info(`[migrate] applying migrations from ${migrationsFolder}`)

	await migrate(db, { migrationsFolder })

	console.info('[migrate] migration run completed')
}

try {
	await main()
	process.exit(0)
} catch (error) {
	console.error('[migrate] migration run failed', error)
	process.exit(1)
}
