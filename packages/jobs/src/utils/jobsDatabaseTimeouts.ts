import type { jobsConfig } from '@zeepkist/core/config/jobs'

type JobsDatabaseTimeoutConfig = Pick<typeof jobsConfig, 'databaseTimeouts'>
type MutableEnv = Record<string, string | undefined>

export function applyJobsDatabaseTimeoutEnvironment(
	config: JobsDatabaseTimeoutConfig,
	env: MutableEnv = process.env,
): void {
	env.DATABASE_CONNECT_TIMEOUT_MS ??= String(config.databaseTimeouts.connectMs)
	env.DATABASE_STATEMENT_TIMEOUT_MS ??= String(config.databaseTimeouts.statementMs)
	env.DATABASE_LOCK_TIMEOUT_MS ??= String(config.databaseTimeouts.lockMs)
	env.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS ??= String(config.databaseTimeouts.idleTransactionMs)
}
