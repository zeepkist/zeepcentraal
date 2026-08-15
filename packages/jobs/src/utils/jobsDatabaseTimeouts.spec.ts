import { expect, test } from 'bun:test'
import { applyJobsDatabaseTimeoutEnvironment } from './jobsDatabaseTimeouts'

const config = {
	databaseTimeouts: {
		connectMs: 5000,
		statementMs: 300000,
		lockMs: 30000,
		idleTransactionMs: 60000,
	},
}

test('applies jobs database timeout defaults before database initialization', () => {
	const env: Record<string, string | undefined> = {}
	applyJobsDatabaseTimeoutEnvironment(config, env)

	expect(env).toEqual({
		DATABASE_CONNECT_TIMEOUT_MS: '5000',
		DATABASE_STATEMENT_TIMEOUT_MS: '300000',
		DATABASE_LOCK_TIMEOUT_MS: '30000',
		DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: '60000',
	})
})

test('preserves explicit database timeout environment values', () => {
	const env = { DATABASE_STATEMENT_TIMEOUT_MS: '90000' }
	applyJobsDatabaseTimeoutEnvironment(config, env)
	expect(env.DATABASE_STATEMENT_TIMEOUT_MS).toBe('90000')
})
