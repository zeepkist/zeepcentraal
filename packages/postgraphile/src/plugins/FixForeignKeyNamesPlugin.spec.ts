import { describe, expect, test } from 'bun:test'
import PgFixForeignKeyNamesPlugin from './FixForeignKeyNamesPlugin'

const objectFieldsHook = PgFixForeignKeyNamesPlugin.schema?.hooks
	?.GraphQLObjectType_fields as unknown as <TFieldMap extends Record<string, unknown>>(
	fields: TFieldMap,
) => TFieldMap

describe('FixForeignKeyNamesPlugin', () => {
	test('renames singular proper noun relation fields to plural names', () => {
		const fields: Record<string, { name: string }> = {
			levelPoint: { name: 'levelPoint' },
			other: { name: 'other' },
			userPoint: { name: 'userPoint' },
		}

		expect(objectFieldsHook(fields)).toEqual({
			levelPoints: { name: 'levelPoint' },
			other: { name: 'other' },
			userPoints: { name: 'userPoint' },
		})
	})

	test('does not overwrite existing plural relation fields', () => {
		const fields: Record<string, { name: string }> = {
			levelPoint: { name: 'levelPoint' },
			levelPoints: { name: 'levelPoints' },
			userPoint: { name: 'userPoint' },
			userPoints: { name: 'userPoints' },
		}

		expect(objectFieldsHook(fields)).toBe(fields)
	})
})
