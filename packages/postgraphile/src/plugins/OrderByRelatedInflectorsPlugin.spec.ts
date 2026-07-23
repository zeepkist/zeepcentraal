import { describe, expect, test } from 'bun:test'
import type { Inflector, PgTable } from '../types'
import OrderByRelatedInflectorsPlugin from './OrderByRelatedInflectorsPlugin'

const inflector = {
	constantCase(value: string) {
		return value
			.replace(/([a-z])([A-Z])/g, '$1_$2')
			.replace(/[-\s]+/g, '_')
			.toUpperCase()
	},
	orderByColumnEnum(column: { name?: string } | string, ascending: boolean) {
		const name = typeof column === 'string' ? column : column.name
		return `${name}_${ascending ? 'asc' : 'desc'}`
	},
	_singularizedTableName(table: PgTable) {
		return table.name.replace(/s$/, '')
	},
} as Inflector

const replacements = OrderByRelatedInflectorsPlugin.inflection?.replace as Record<
	string,
	(this: Inflector, previous: unknown, options: unknown, ...args: unknown[]) => string
>
const orderByRelatedColumnEnum = replacements.orderByRelatedColumnEnum as (
	this: Inflector,
	previous: unknown,
	options: unknown,
	attr: { name: string },
	ascending: boolean,
	foreignTable: PgTable,
) => string
const enumValuesHook = OrderByRelatedInflectorsPlugin.schema?.hooks
	?.GraphQLEnumType_values as unknown as (
	values: Record<string, unknown>,
	build: unknown,
	context: unknown,
) => Record<string, { extensions?: { grafast?: { apply?: (select: unknown) => void } } }>

describe('OrderByRelatedInflectorsPlugin', () => {
	test('keeps plural proper noun table names in related order enums', () => {
		const levelPoints = orderByRelatedColumnEnum.call(
			inflector,
			undefined,
			undefined,
			{ name: 'points' },
			true,
			{ name: 'level_point' },
		)
		const userPoints = orderByRelatedColumnEnum.call(
			inflector,
			undefined,
			undefined,
			{ name: 'points' },
			false,
			{ name: 'user_point' },
		)

		expect(levelPoints).toBe('LEVEL_POINTS_POINTS_ASC')
		expect(userPoints).toBe('USER_POINTS_POINTS_DESC')
	})

	test('keeps existing related order enum naming for normal table names', () => {
		const value = orderByRelatedColumnEnum.call(
			inflector,
			undefined,
			undefined,
			{ name: 'time' },
			true,
			{ name: 'record' },
		)

		expect(value).toBe('RECORD_TIME_ASC')
	})

	test('adds direct order values for unique plural proper noun relations', () => {
		const values = enumValuesHook(
			{},
			{
				inflection: inflector,
				pgSql: {
					fragment(strings: TemplateStringsArray, ...values: unknown[]) {
						return { strings, values }
					},
					identifier(name: string) {
						return { identifier: name }
					},
				},
				pgRelations: {
					level: {
						levelPointsByTheirIdLevel: {
							isUnique: true,
							remoteResource: {
								name: 'level_points',
								codec: {
									attributes: {
										points: {
											codec: { hasNaturalOrdering: true },
										},
										blocks: {
											codec: { hasNaturalOrdering: false },
										},
									},
								},
							},
						},
						userPointsByTheirIdUser: {
							isUnique: true,
							remoteResource: {
								name: 'user_points',
								codec: {
									attributes: {
										points: {
											codec: { hasNaturalOrdering: true },
										},
									},
								},
							},
						},
					},
				},
			},
			{
				scope: {
					isPgRowSortEnum: true,
					pgCodec: { name: 'level' },
				},
			},
		)
		const orderCalls: unknown[] = []
		const select = {
			singleRelation(relationName: string) {
				return { relationName }
			},
			orderBy(order: unknown) {
				orderCalls.push(order)
			},
		}

		values.LEVEL_POINTS_POINTS_ASC?.extensions?.grafast?.apply?.(select)
		values.USER_POINTS_POINTS_ASC?.extensions?.grafast?.apply?.(select)

		expect(values.LEVEL_POINTS_POINTS_ASC).toBeDefined()
		expect(values.LEVEL_POINTS_POINTS_DESC).toBeDefined()
		expect(values.LEVEL_POINTS_BLOCKS_ASC).toBeUndefined()
		expect(orderCalls).toHaveLength(2)
		expect(orderCalls[0]).toMatchObject({
			direction: 'ASC',
			nullable: true,
			nulls: 'LAST',
		})
		expect(orderCalls[1]).not.toHaveProperty('nulls')
	})
})
