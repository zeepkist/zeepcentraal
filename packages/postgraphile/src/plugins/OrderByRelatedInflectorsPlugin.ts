import type { Inflector, PgTable } from '../types'

function relatedOrderBy(inflector: Inflector, foreignTable: PgTable, orderBy: string) {
	return inflector.constantCase(`${inflector._singularizedTableName(foreignTable)}_${orderBy}`)
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
			'orderByRelatedCountEnum',
			'orderByRelatedColumnAggregateEnum',
		] as never,
	},
}

export default OrderByRelatedInflectorsPlugin
