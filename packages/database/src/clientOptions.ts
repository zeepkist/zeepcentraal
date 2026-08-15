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
		max: 5,
		idle_timeout: 30,
		...(connectMs !== undefined && { connect_timeout: connectMs / 1000 }),
		...(Object.keys(connection).length > 0 && { connection }),
	}
}
