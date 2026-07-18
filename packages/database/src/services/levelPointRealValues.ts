import { getTableColumns } from 'drizzle-orm'
import { levelPoints } from '../schema'

const POSTGRES_REAL_MIN_NORMAL = 1.1754943508222875e-38
const POSTGRES_REAL_MAX = 3.4028234663852886e38

type LevelPointInsert = typeof levelPoints.$inferInsert
type LevelPointRealField = keyof LevelPointInsert

export const levelPointRealFields = Object.entries(getTableColumns(levelPoints))
	.filter(([, column]) => column.columnType === 'PgReal')
	.map(([field]) => field as LevelPointRealField)

const invalidRealError = (
	idLevel: number,
	field: LevelPointRealField,
	value: unknown,
): RangeError =>
	new RangeError(
		`level_points.${String(field)} for level ${idLevel} must fit a finite PostgreSQL real; received ${String(value)}`,
	)

export function sanitizeLevelPointRealValues<T extends LevelPointInsert>(payload: T): T {
	const sanitized = { ...payload }
	const writable = sanitized as Record<string, unknown>

	for (const field of levelPointRealFields) {
		const value = writable[field]
		if (value === null || value === undefined) {
			continue
		}
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw invalidRealError(payload.idLevel, field, value)
		}

		const magnitude = Math.abs(value)
		if (magnitude > POSTGRES_REAL_MAX) {
			throw invalidRealError(payload.idLevel, field, value)
		}
		if (magnitude < POSTGRES_REAL_MIN_NORMAL) {
			writable[field] = 0
		}
	}

	return sanitized
}
