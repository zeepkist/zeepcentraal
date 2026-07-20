export const MIGRATION_MAX_ATTEMPTS = 6
export const MIGRATION_RETRY_BASE_DELAY_MS = 1_000
export const MIGRATION_RETRY_MAX_DELAY_MS = 10_000
export const MIGRATION_RETRY_JITTER_RATIO = 0.25

const retryableMigrationSqlStates = new Set([
	'40P01', // deadlock_detected
	'40001', // serialization_failure
])

const migrationSqlStateDescriptions: Readonly<Record<string, string>> = {
	'40P01': 'deadlock detected',
	'40001': 'serialization failure',
	'55P03': 'lock unavailable; stop database clients and retry',
}

interface ErrorWithCause {
	readonly cause?: unknown
	readonly code?: unknown
}

export interface MigrationRetryEvent {
	readonly attempt: number
	readonly code: string
	readonly delayMs: number
	readonly maxAttempts: number
	readonly nextAttempt: number
}

export interface MigrationRetryOptions {
	readonly maxAttempts?: number
	readonly onRetry?: (event: MigrationRetryEvent) => void
	readonly random?: () => number
	readonly sleep?: (delayMs: number) => Promise<void>
}

function isErrorWithCause(value: unknown): value is ErrorWithCause {
	return typeof value === 'object' && value !== null
}

/** Finds PostgreSQL SQLSTATE through wrapper errors such as DrizzleQueryError. */
export function getPostgresSqlState(error: unknown): string | undefined {
	const seen = new Set<object>()
	let current = error

	for (let depth = 0; depth < 8 && isErrorWithCause(current); depth++) {
		if (seen.has(current)) return undefined
		seen.add(current)

		if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) {
			return current.code
		}

		current = current.cause
	}

	return undefined
}

export function isRetryableMigrationError(error: unknown): boolean {
	const code = getPostgresSqlState(error)
	return code !== undefined && retryableMigrationSqlStates.has(code)
}

export function getMigrationRetryDelayMs(
	failedAttempt: number,
	random: () => number = Math.random,
): number {
	const exponent = Math.max(0, failedAttempt - 1)
	const baseDelay = Math.min(
		MIGRATION_RETRY_MAX_DELAY_MS,
		MIGRATION_RETRY_BASE_DELAY_MS * 2 ** exponent,
	)
	const randomValue = Math.min(1, Math.max(0, random()))
	return Math.round(baseDelay * (1 + randomValue * MIGRATION_RETRY_JITTER_RATIO))
}

/**
 * Retries complete Drizzle migration transactions after transient PostgreSQL failures.
 * Drizzle records migration journal entries in the same transaction, so failed attempts roll back.
 */
export async function runMigrationWithRetry<T>(
	operation: () => Promise<T>,
	options: MigrationRetryOptions = {},
): Promise<T> {
	const maxAttempts = options.maxAttempts ?? MIGRATION_MAX_ATTEMPTS
	const random = options.random ?? Math.random
	const sleep = options.sleep ?? ((delayMs) => Bun.sleep(delayMs))

	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
		throw new RangeError('Migration max attempts must be a positive safe integer')
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await operation()
		} catch (error) {
			const code = getPostgresSqlState(error)
			if (
				code === undefined ||
				!retryableMigrationSqlStates.has(code) ||
				attempt === maxAttempts
			) {
				throw error
			}

			const delayMs = getMigrationRetryDelayMs(attempt, random)
			options.onRetry?.({
				attempt,
				nextAttempt: attempt + 1,
				maxAttempts,
				code,
				delayMs,
			})
			await sleep(delayMs)
		}
	}

	throw new Error('Migration retry loop ended unexpectedly')
}

/** Returns bounded diagnostics without query text, parameters, URLs, or credentials. */
export function describeMigrationError(error: unknown): string {
	const code = getPostgresSqlState(error)
	if (code === undefined) return 'database operation failed'

	const description = migrationSqlStateDescriptions[code] ?? 'database error'
	return `PostgreSQL ${code} (${description})`
}
