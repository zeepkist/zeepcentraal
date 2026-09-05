import { SQL } from 'bun'

/** Explicit factory boundary so unit tests never open native database connections. */
export function createSqlClient(url: string, options: SQL.PostgresOrMySQLOptions = {}): SQL {
	return new SQL(url, { ...options, adapter: 'postgres' })
}
