import type { Inflector, PgTable } from '../types'
import { pluralProperNounTableFieldName } from './pluginUtils'

type PgAttribute = {
	codec: {
		hasNaturalOrdering?: boolean
	}
}

type PgRelation = {
	isUnique?: boolean
	remoteResource: {
		name: string
		codec: {
			attributes: Record<string, PgAttribute>
		}
	}
}

type OrderByBuild = {
	inflection: {
		constantCase(value: string): string
	}
	pgRelations: Record<string, Record<string, PgRelation>>
	pgSql: {
		fragment(strings: TemplateStringsArray, ...values: unknown[]): unknown
		identifier(name: string): unknown
	}
}

function relatedOrderBy(inflector: Inflector, foreignTable: PgTable, orderBy: string) {
	const relatedFieldName =
		pluralProperNounTableFieldName(foreignTable) ??
		inflector._singularizedTableName(foreignTable)

	return inflector.constantCase(`${relatedFieldName}_${orderBy}`)
}

const OrderByRelatedInflectorsPlugin: GraphileConfig.Plugin = {
	name: 'OrderByRelatedInflectorsPlugin',
	version: '1.0.0',
	inflection: {
		replace: {
			orderByRelatedColumnEnum(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				attr: unknown,
				ascending: boolean,
				foreignTable: PgTable,
			) {
				const orderBy = this.orderByColumnEnum(attr, ascending)

				return relatedOrderBy(this, foreignTable, orderBy)
			},
			orderByRelatedComputedEnum(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				pseudoColumnName: string,
				proc: unknown,
				ascending: boolean,
				foreignTable: PgTable,
			) {
				const orderBy = this.orderByColumnEnum(pseudoColumnName, proc, ascending)

				return relatedOrderBy(this, foreignTable, orderBy)
			},
			orderByRelatedComputedColumnEnum(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				pseudoColumnName: string,
				proc: unknown,
				ascending: boolean,
				foreignTable: PgTable,
			) {
				const orderBy = this.orderByColumnEnum(pseudoColumnName, proc, ascending)

				return relatedOrderBy(this, foreignTable, orderBy)
			},
			orderByRelatedCountEnum(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				ascending: boolean,
				foreignTable: PgTable,
			) {
				const orderBy = `count-${ascending ? 'asc' : 'desc'}`

				return relatedOrderBy(this, foreignTable, orderBy)
			},
			orderByRelatedColumnAggregateEnum(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				attr: unknown,
				ascending: boolean,
				foreignTable: PgTable,
				_keyAttributes: unknown,
				aggregateName: string,
			) {
				const orderBy = `${aggregateName}_${this.orderByColumnEnum(attr, ascending)}`

				return relatedOrderBy(this, foreignTable, orderBy)
			},
		} as never,
		ignoreReplaceIfNotExists: [
			'orderByRelatedColumnEnum',
			'orderByRelatedComputedEnum',
			'orderByRelatedComputedColumnEnum',
			'orderByRelatedCountEnum',
			'orderByRelatedColumnAggregateEnum',
		] as never,
	},
	schema: {
		hooks: {
			GraphQLEnumType_values(values, build, context) {
				const { pgCodec, isPgRowSortEnum } = context.scope
				if (!isPgRowSortEnum || !pgCodec?.name) {
					return values
				}

				const orderByBuild = build as unknown as OrderByBuild
				const relations = orderByBuild.pgRelations[pgCodec.name]
				if (!relations) {
					return values
				}

				let next: typeof values | undefined
				for (const [relationName, relation] of Object.entries(relations)) {
					if (!relation.isUnique) {
						continue
					}

					const relationFieldName = pluralProperNounTableFieldName({
						name: relation.remoteResource.name,
					})
					if (!relationFieldName) {
						continue
					}

					for (const [attributeName, attribute] of Object.entries(
						relation.remoteResource.codec.attributes,
					)) {
						if (!attribute.codec.hasNaturalOrdering) {
							continue
						}

						next ??= { ...values }
						for (const direction of ['ASC', 'DESC'] as const) {
							const enumName = orderByBuild.inflection.constantCase(
								`${relationFieldName}_${attributeName}_${direction.toLowerCase()}`,
							)
							if (enumName in next) {
								continue
							}

							next[enumName] = {
								value: enumName,
								extensions: {
									grafast: {
										apply($select: RelatedOrderSelect) {
											const alias = $select.singleRelation(relationName)
											$select.orderBy({
												fragment: orderByBuild.pgSql
													.fragment`${alias}.${orderByBuild.pgSql.identifier(attributeName)}`,
												codec: attribute.codec,
												direction,
												nullable: true,
											})
										},
									},
								},
							}
						}
					}
				}

				return next ?? values
			},
		},
	},
}

type RelatedOrderSelect = {
	singleRelation(relationName: string): unknown
	orderBy(order: {
		fragment: unknown
		codec: unknown
		direction: 'ASC' | 'DESC'
		nullable: boolean
	}): void
}

export default OrderByRelatedInflectorsPlugin
