import type { Inflector, PgConstraint, PgTable } from '../types'
import { pascalCase, relationByJunctionFieldName } from './pluginUtils'

type ManyToManyRelationDetails = {
	junctionTable: {
		codec: unknown
		getRelation(relationName: string): {
			extensions?: { tags?: { foreignFieldName?: string; manyToManyFieldName?: string } }
		}
	}
	rightTable: { codec: unknown }
	leftTable?: {
		getRelation(relationName: string): {
			extensions?: { tags?: { foreignFieldName?: string } }
		}
	}
	leftRelationName?: string
	rightRelationName?: string
}

const PgManyToManyInflectorsPlugin: GraphileConfig.Plugin = {
	name: 'PgManyToManyInflectorsPlugin',
	version: '1.0.0',
	inflection: {
		replace: {
			_manyToManyRelation(
				this: Inflector,
				previous: ((details: ManyToManyRelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: ManyToManyRelationDetails,
			) {
				const baseOverride = details.rightRelationName
					? details.junctionTable.getRelation(details.rightRelationName).extensions?.tags
							?.manyToManyFieldName
					: undefined

				if (typeof baseOverride === 'string') {
					return baseOverride
				}

				if (!details.rightTable || !details.junctionTable) {
					return previous?.(details) ?? ''
				}

				const baseName = this.camelCase(
					this.pluralize(this.tableType(details.rightTable.codec)),
				)
				const suffix = pascalCase(
					this.camelCase(this.tableType(details.junctionTable.codec)),
				)

				return `${baseName}By${suffix}`
			},
			_manyToManyEdgeRelation(
				this: Inflector,
				previous: ((details: ManyToManyRelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: ManyToManyRelationDetails,
			) {
				const baseOverride = details.leftRelationName
					? details.leftTable?.getRelation(details.leftRelationName).extensions?.tags
							?.foreignFieldName
					: undefined

				if (typeof baseOverride === 'string') {
					return baseOverride
				}

				if (!details.junctionTable) {
					return previous?.(details) ?? ''
				}

				return this.camelCase(this.pluralize(this.tableType(details.junctionTable.codec)))
			},
			manyToManyRelationByKeys(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
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

				return relationByJunctionFieldName(this, rightTable, junctionTable)
			},
			manyToManyRelationByKeysSimple(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
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

				return relationByJunctionFieldName(this, rightTable, junctionTable, {
					simple: true,
				})
			},
		} as never,
		ignoreReplaceIfNotExists: [
			'_manyToManyRelation',
			'_manyToManyEdgeRelation',
			'manyToManyRelationByKeys',
			'manyToManyRelationByKeysSimple',
		] as never,
	},
}

export default PgManyToManyInflectorsPlugin
