import { migrateConfig } from '@zeepkist/core/config/migrate'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { databaseHandle, db } from './index'
import { describeMigrationError, runMigrationWithRetry } from './migrationRetry'

async function main() {
	const migrationsFolder = migrateConfig.migrationsFolder
	console.info(`[migrate] applying migrations from ${migrationsFolder}`)

	await runMigrationWithRetry(() => migrate(db, { migrationsFolder }), {
		onRetry: ({ attempt, nextAttempt, maxAttempts, code, delayMs }) => {
			console.warn(
				`[migrate] transient PostgreSQL ${code} on attempt ${attempt}; retrying attempt ${nextAttempt}/${maxAttempts} in ${delayMs}ms`,
			)
		},
	})

	console.info('[migrate] migration run completed')
}

await using _database = databaseHandle
try {
	await main()
} catch (error) {
	console.error(`[migrate] migration run failed: ${describeMigrationError(error)}`)
	process.exitCode = 1
}
