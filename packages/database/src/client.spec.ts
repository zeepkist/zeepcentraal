import { expect, test } from 'bun:test'
import { createDatabaseClientOptions } from './clientOptions'

test('creates bounded Bun SQL options when jobs bootstrap provides timeouts', () => {
	expect(
		createDatabaseClientOptions({
			databaseTimeouts: {
				connectMs: 5000,
				statementMs: 300000,
				lockMs: 30000,
				idleTransactionMs: 60000,
			},
		}),
	).toEqual({
		connectionTimeout: 5,
		connection: {
			statement_timeout: 300000,
			lock_timeout: 30000,
			idle_in_transaction_session_timeout: 60000,
		},
		idleTimeout: 30,
		max: 5,
		prepare: false,
	})
})

test('leaves database timeouts disabled for non-jobs runtimes by default', () => {
	expect(
		createDatabaseClientOptions({
			databaseTimeouts: {
				connectMs: undefined,
				statementMs: undefined,
				lockMs: undefined,
				idleTransactionMs: undefined,
			},
		}),
	).toEqual({ idleTimeout: 30, max: 5, prepare: false })
})
