import { makeAddInflectorsPlugin } from 'graphile-utils'
import type { Inflector, PgTable } from '../types'

export default makeAddInflectorsPlugin(
	{
		orderByRelatedColumnEnum(
			this: Inflector,
			attr: unknown,
			ascending: boolean,
			foreignTable: PgTable,
		) {
			const orderBy = this.orderByColumnEnum(attr, ascending)
			const table = this._singularizedTableName(foreignTable)

			return this.constantCase(`${table}_${orderBy}`)
		},

		orderByRelatedComputedEnum(
			this: Inflector,
			pseudoColumnName: string,
			proc: unknown,
			ascending: boolean,
			foreignTable: PgTable,
		) {
			const orderBy = this.orderByColumnEnum(pseudoColumnName, proc, ascending)
			const table = this._singularizedTableName(foreignTable)

			return this.constantCase(`${table}_${orderBy}`)
		},

		orderByRelatedCountEnum(this: Inflector, ascending: boolean, foreignTable: PgTable) {
			const orderBy = `count-${ascending ? 'asc' : 'desc'}`
			const table = this._singularizedTableName(foreignTable)

			return this.constantCase(`${table}_${orderBy}`)
		},

		orderByRelatedColumnAggregateEnum(
			this: Inflector,
			attr: unknown,
			ascending: boolean,
			foreignTable: PgTable,
			_keyAttributes: unknown,
			aggregateName: string,
		) {
			const orderBy = `${aggregateName}_${this.orderByColumnEnum(attr, ascending)}`
			const table = this._singularizedTableName(foreignTable)

			return this.constantCase(`${table}_${orderBy}`)
		},
	},
	true,
)
