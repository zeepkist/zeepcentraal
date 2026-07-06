import type { Inflector, PgTable } from '../types'
import {
	getCodecName,
	getRelation,
	getTaggedRelationFieldName,
	type PgRelationDetails,
} from './pluginUtils'

type AttributeNameDetails = {
	attributeName: string
	codec: {
		attributes: Record<string, { extensions?: { tags?: { name?: string } } }>
		isAnonymous?: boolean
	}
	skipRowId?: boolean
}

const pluralProperNounFieldNames = new Map([
	['user_points', 'userPoints'],
	['user_point', 'userPoints'],
	['level_points', 'levelPoints'],
	['level_point', 'levelPoints'],
])

const pluralProperNounRelationFieldRenames = new Map([
	['userPoint', 'userPoints'],
	['levelPoint', 'levelPoints'],
])

const pluralProperNounFieldName = (codec: unknown) => {
	const codecName = getCodecName(codec)
	return codecName ? pluralProperNounFieldNames.get(codecName) : undefined
}

const pluralProperNounTableFieldName = (table: PgTable) =>
	pluralProperNounFieldNames.get(table.name)

const relationFieldName = (details: PgRelationDetails) => {
	const relation = getRelation(details)
	if (!relation) {
		return undefined
	}

	return (
		getTaggedRelationFieldName(relation) ??
		pluralProperNounFieldName(relation.remoteResource.codec)
	)
}

const renamePluralProperNounRelationFields = <TFieldMap extends Record<string, unknown>>(
	fields: TFieldMap,
): TFieldMap => {
	let next: Record<string, unknown> | undefined

	for (const [singularFieldName, pluralFieldName] of pluralProperNounRelationFieldRenames) {
		if (!(singularFieldName in fields) || pluralFieldName in fields) {
			continue
		}

		next ??= { ...fields }
		next[pluralFieldName] = next[singularFieldName]
		delete next[singularFieldName]
	}

	if (!next) {
		return fields
	}

	return next as TFieldMap
}

const swapId = (value: string) => {
	if (value.startsWith('id_')) {
		return `${value.replace(/^id_/, '')}_id`
	}

	return value
}

const PgFixForeignKeyNamesPlugin: GraphileConfig.Plugin = {
	name: 'PgFixForeignKeyNamesPlugin',
	version: '1.0.0',
	inflection: {
		replace: {
			_attributeName(
				this: Inflector,
				previous: ((details: AttributeNameDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: AttributeNameDetails,
			) {
				const attribute = details.codec.attributes[details.attributeName]
				const name = attribute?.extensions?.tags?.name ?? details.attributeName
				const swappedName = swapId(name)

				if (
					!details.skipRowId &&
					swappedName.toLowerCase() === 'id' &&
					!details.codec.isAnonymous
				) {
					return previous?.(details) ?? 'row_id'
				}

				return this.coerceToGraphQLName(swappedName)
			},
			column(
				this: Inflector,
				previous: ((column: { name: string }) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				column: { name: string },
			) {
				return this.camelCase(swapId(column.name ?? previous?.(column) ?? ''))
			},
			singleRelationByKeys(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				_detailedKeys: unknown,
				table: PgTable,
			) {
				const fieldName = pluralProperNounTableFieldName(table)
				if (fieldName) {
					return fieldName
				}

				return this.camelCase(table.name)
			},
			manyRelationByKeys(
				this: Inflector,
				_previous: unknown,
				_options: GraphileConfig.ResolvedPreset,
				_detailedKeys: unknown,
				table: PgTable,
			) {
				return this.pluralize(this.camelCase(table.name))
			},
			singleRelation(
				this: Inflector,
				previous: ((details: PgRelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: PgRelationDetails,
			) {
				return relationFieldName(details) ?? previous?.(details) ?? ''
			},
			singleRelationBackwards(
				this: Inflector,
				previous: ((details: PgRelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: PgRelationDetails,
			) {
				return relationFieldName(details) ?? previous?.(details) ?? ''
			},
			_manyRelation(
				this: Inflector,
				previous: ((details: PgRelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: PgRelationDetails,
			) {
				const relation = getRelation(details)

				if (!relation) {
					return previous?.(details) ?? ''
				}

				if (relation.extensions?.tags?.foreignFieldName) {
					return relation.extensions.tags.foreignFieldName
				}

				return this.camelCase(this.pluralize(this.tableType(relation.remoteResource.codec)))
			},
		} as never,
		ignoreReplaceIfNotExists: [
			'_attributeName',
			'_manyRelation',
			'column',
			'singleRelationByKeys',
			'singleRelation',
			'singleRelationBackwards',
			'manyRelationByKeys',
		] as never,
	},
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields) {
				return renamePluralProperNounRelationFields(fields)
			},
			GraphQLInputObjectType_fields(fields) {
				return renamePluralProperNounRelationFields(fields)
			},
		},
	},
}

export default PgFixForeignKeyNamesPlugin
