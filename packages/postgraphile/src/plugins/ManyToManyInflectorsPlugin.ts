import { makeAddInflectorsPlugin } from 'graphile-utils'
import type { Inflector, PgConstraint, PgTable } from '../types'

const pascalCase = (value: string) => value[0]?.toUpperCase() + value.slice(1)

export default makeAddInflectorsPlugin(
	{
		manyToManyRelationByKeys(
			this: Inflector,
			_leftKeyAttributes: unknown,
			_junctionLeftKeyAttributes: unknown,
			_junctionRightKeyAttributes: unknown,
			_rightKeyAttributes: unknown,
			junctionTable: PgTable,
			rightTable: PgTable,
			_junctionLeftConstraint: unknown,
			junctionRightConstraint: PgConstraint,
		) {
			if (junctionRightConstraint.tags.manyToManyFieldName) {
				return junctionRightConstraint.tags.manyToManyFieldName
			}

			const baseName = this.camelCase(
				`${this.pluralize(this._singularizedTableName(rightTable))}`,
			)
			const suffix = pascalCase(this.camelCase(this._singularizedTableName(junctionTable)))

			return `${baseName}By${suffix}`
		},

		manyToManyRelationByKeysSimple(
			this: Inflector,
			_leftKeyAttributes: unknown,
			_junctionLeftKeyAttributes: unknown,
			_junctionRightKeyAttributes: unknown,
			_rightKeyAttributes: unknown,
			junctionTable: PgTable,
			rightTable: PgTable,
			_junctionLeftConstraint: unknown,
			junctionRightConstraint: PgConstraint,
		) {
			if (junctionRightConstraint.tags.manyToManySimpleFieldName) {
				return junctionRightConstraint.tags.manyToManySimpleFieldName
			}

			const baseName = this.camelCase(
				`${this.pluralize(this._singularizedTableName(rightTable))}-list`,
			)
			const suffix = pascalCase(this.camelCase(this._singularizedTableName(junctionTable)))

			return `${baseName}By${suffix}`
		},
	},
	true,
)
