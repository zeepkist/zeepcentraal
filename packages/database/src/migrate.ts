import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'

function resolvePath(value: string) {
	if (isAbsolute(value)) {
		return value
	}

	return resolve(process.cwd(), value)
}

function resolveMigrationsFolder() {
	const configuredPath = process.env.MIGRATIONS_FOLDER
	if (configuredPath) {
		return resolvePath(configuredPath)
	}

	const candidates = [
		resolve(process.cwd(), 'drizzle'),
		resolve(process.cwd(), 'packages/database/drizzle'),
	]
	const existingPath = candidates.find((candidate) => existsSync(candidate))

	return existingPath ?? candidates[0] ?? resolve(process.cwd(), 'drizzle')
}

async function main() {
	const migrationsFolder = resolveMigrationsFolder()
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
