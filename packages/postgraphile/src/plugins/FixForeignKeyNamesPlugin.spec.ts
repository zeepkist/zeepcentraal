import { describe, expect, test } from 'bun:test'
import PgFixForeignKeyNamesPlugin from './FixForeignKeyNamesPlugin'

const objectFieldsHook = PgFixForeignKeyNamesPlugin.schema?.hooks
	?.GraphQLObjectType_fields as unknown as <TFieldMap extends Record<string, unknown>>(
	fields: TFieldMap,
) => TFieldMap

type RelationInflector = (
	this: unknown,
	previous: (details: unknown) => string,
	options: unknown,
	details: unknown,
) => string

const relationInflectors = PgFixForeignKeyNamesPlugin.inflection?.replace as unknown as {
	singleRelation: RelationInflector
	singleRelationBackwards: RelationInflector
}

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

	test('uses local tags forwards and foreign tags backwards', () => {
		const details = {
			codec: { name: 'discord_activity_event' },
			relationName: 'discord_activity_event_user_fkey',
			registry: {
				pgRelations: {
					discord_activity_event: {
						discord_activity_event_user_fkey: {
							extensions: {
								tags: {
									fieldName: 'user',
									foreignFieldName: 'discordActivityEvents',
								},
							},
							remoteResource: { codec: { name: 'user' } },
						},
					},
				},
			},
		}
		const previous = () => 'fallback'

		expect(relationInflectors.singleRelation.call({}, previous, {}, details)).toBe('user')
		expect(relationInflectors.singleRelationBackwards.call({}, previous, {}, details)).toBe(
			'discordActivityEvents',
		)
	})
})
