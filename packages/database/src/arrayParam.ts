import { sql } from 'drizzle-orm'
import { makePgArray } from 'drizzle-orm/pg-core'

/** Bind one PostgreSQL array parameter without relying on native client array coercion. */
export function arrayParam(values: (string | number | bigint | boolean | null)[]) {
	return sql.param(values, { mapToDriverValue: makePgArray })
}
