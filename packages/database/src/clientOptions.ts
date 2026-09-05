export interface DatabaseClientTimeouts {
	connectMs?: number
	idleTransactionMs?: number
	lockMs?: number
	statementMs?: number
}

export function createDatabaseClientOptions(config: { databaseTimeouts: DatabaseClientTimeouts }) {
	const { connectMs, idleTransactionMs, lockMs, statementMs } = config.databaseTimeouts
	const connection = {
		...(statementMs !== undefined && { statement_timeout: statementMs }),
		...(lockMs !== undefined && { lock_timeout: lockMs }),
		...(idleTransactionMs !== undefined && {
			idle_in_transaction_session_timeout: idleTransactionMs,
		}),
	}

	return {
		// Match text-encoded parameters supplied by Drizzle (notably JSON).
		prepare: false,
		max: 5,
		idleTimeout: 30,
		...(connectMs !== undefined && { connectionTimeout: connectMs / 1000 }),
		...(Object.keys(connection).length > 0 && { connection }),
	}
}
