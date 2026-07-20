import { describe, expect, mock, test } from 'bun:test'
import {
	describeMigrationError,
	getMigrationRetryDelayMs,
	getPostgresSqlState,
	isRetryableMigrationError,
	runMigrationWithRetry,
} from './migrationRetry'

function postgresError(code: string, message = 'database failure'): Error {
	return Object.assign(new Error(message), { code })
}

function drizzleError(code: string, message = 'query includes secret-token'): Error {
	return new Error(message, { cause: postgresError(code, 'connection contains secret-password') })
}

describe('migration retry classification', () => {
	test('finds SQLSTATE through wrapped causes', () => {
		expect(getPostgresSqlState(drizzleError('40P01'))).toBe('40P01')
	})

	test('accepts only transient transaction failures', () => {
		for (const code of ['40P01', '40001']) {
			expect(isRetryableMigrationError(drizzleError(code))).toBe(true)
		}

		for (const code of ['23505', '42501', '42P01', '55P03', '57014']) {
			expect(isRetryableMigrationError(drizzleError(code))).toBe(false)
		}
	})

	test('handles malformed and cyclic causes', () => {
		const cyclic: { cause?: unknown } = {}
		cyclic.cause = cyclic

		expect(getPostgresSqlState(cyclic)).toBeUndefined()
		expect(getPostgresSqlState({ code: 'not-sqlstate' })).toBeUndefined()
	})
})

describe('migration retry timing', () => {
	test('uses bounded exponential backoff and jitter', () => {
		expect(getMigrationRetryDelayMs(1, () => 0)).toBe(1_000)
		expect(getMigrationRetryDelayMs(2, () => 1)).toBe(2_500)
		expect(getMigrationRetryDelayMs(5, () => 0)).toBe(10_000)
		expect(getMigrationRetryDelayMs(20, () => 1)).toBe(12_500)
	})
})

describe('runMigrationWithRetry', () => {
	test('retries complete operation after transient failures', async () => {
		let attempts = 0
		const sleep = mock(async (_delayMs: number) => {})
		const onRetry = mock(() => {})

		const result = await runMigrationWithRetry(
			async () => {
				attempts++
				if (attempts === 1) throw drizzleError('40P01')
				if (attempts === 2) throw postgresError('40001')
				return 'migrated'
			},
			{ random: () => 0, sleep, onRetry },
		)

		expect(result).toBe('migrated')
		expect(attempts).toBe(3)
		expect(sleep).toHaveBeenCalledTimes(2)
		expect(sleep).toHaveBeenNthCalledWith(1, 1_000)
		expect(sleep).toHaveBeenNthCalledWith(2, 2_000)
		expect(onRetry).toHaveBeenNthCalledWith(1, {
			attempt: 1,
			nextAttempt: 2,
			maxAttempts: 6,
			code: '40P01',
			delayMs: 1_000,
		})
	})

	test('does not retry permanent failures', async () => {
		const operation = mock(async () => {
			throw drizzleError('42501')
		})
		const sleep = mock(async (_delayMs: number) => {})

		expect(runMigrationWithRetry(operation, { sleep })).rejects.toThrow()
		expect(operation).toHaveBeenCalledTimes(1)
		expect(sleep).not.toHaveBeenCalled()
	})

	test('stops after bounded attempts', async () => {
		const operation = mock(async () => {
			throw drizzleError('40001')
		})
		const sleep = mock(async (_delayMs: number) => {})

		expect(
			runMigrationWithRetry(operation, {
				maxAttempts: 3,
				random: () => 0,
				sleep,
			}),
		).rejects.toThrow()
		expect(operation).toHaveBeenCalledTimes(3)
		expect(sleep).toHaveBeenCalledTimes(2)
	})

	test('rejects invalid attempt limits', () => {
		expect(runMigrationWithRetry(async () => undefined, { maxAttempts: 0 })).rejects.toThrow(
			'Migration max attempts must be a positive safe integer',
		)
	})
})

describe('migration error diagnostics', () => {
	test('reports SQLSTATE without leaking wrapped query or connection details', () => {
		const summary = describeMigrationError(drizzleError('40P01'))

		expect(summary).toBe('PostgreSQL 40P01 (deadlock detected)')
		expect(summary).not.toContain('secret-token')
		expect(summary).not.toContain('secret-password')
	})

	test('makes a lock-drain timeout actionable without retrying it', () => {
		expect(describeMigrationError(drizzleError('55P03'))).toBe(
			'PostgreSQL 55P03 (lock unavailable; stop database clients and retry)',
		)
	})

	test('does not expose unknown error messages', () => {
		expect(describeMigrationError(new Error('DATABASE_URL=postgres://secret'))).toBe(
			'database operation failed',
		)
	})
})
