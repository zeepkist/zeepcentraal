import { makeAddInflectorsPlugin } from 'graphile-utils'
import type { Inflector, PgTable } from '../types'

const swapId = (value: string) => {
	if (value.startsWith('id_')) {
		return `${value.replace(/^id_/, '')}_id`
	}

	return value
}

export default makeAddInflectorsPlugin(
	{
		column(this: Inflector, column: { name: string }) {
			return this.camelCase(swapId(column.name))
		},

		singleRelationByKeys(this: Inflector, _detailedKeys: unknown, table: PgTable) {
			return this.camelCase(table.name)
		},

		manyRelationByKeys(this: Inflector, _detailedKeys: unknown, table: PgTable) {
			return this.pluralize(this.camelCase(table.name))
		},
	},
	true,
)
