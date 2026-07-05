import type { Inflector, PgTable } from '../types'

type AttributeNameDetails = {
	attributeName: string
	codec: {
		attributes: Record<string, { extensions?: { tags?: { name?: string } } }>
		isAnonymous?: boolean
	}
	skipRowId?: boolean
}

type RelationDetails = {
	registry: {
		pgRelations: Record<
			string,
			Record<
				string,
				{
					remoteResource: { codec: unknown }
					extensions?: {
						tags?: { foreignFieldName?: string; foreignSingleFieldName?: string }
					}
				}
			>
		>
	}
	codec: { name: string }
	relationName: string
}

type PgCodec = {
	name?: string
	extensions?: {
		tags?: {
			name?: string
		}
	}
}

const pluralProperNounFieldNames = new Map([
	['user_points', 'userPoints'],
	['user_point', 'userPoints'],
])

const getCodecName = (codec: unknown) => {
	if (!codec || typeof codec !== 'object') {
		return undefined
	}

	const pgCodec = codec as PgCodec
	return pgCodec.extensions?.tags?.name ?? pgCodec.name
}

const pluralProperNounFieldName = (codec: unknown) => {
	const codecName = getCodecName(codec)
	return codecName ? pluralProperNounFieldNames.get(codecName) : undefined
}

const pluralProperNounTableFieldName = (table: PgTable) =>
	pluralProperNounFieldNames.get(table.name)

const renameUserPointRelationField = <TFieldMap extends Record<string, unknown>>(
	fields: TFieldMap,
): TFieldMap => {
	if (!('userPoint' in fields) || 'userPoints' in fields) {
		return fields
	}

	const next: Record<string, unknown> = { ...fields }
	next.userPoints = next.userPoint
	delete next.userPoint

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
				previous: ((details: RelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: RelationDetails,
			) {
				const relation =
					details.registry.pgRelations[details.codec.name]?.[details.relationName]

				if (!relation) {
					return previous?.(details) ?? ''
				}

				if (relation.extensions?.tags?.foreignSingleFieldName) {
					return relation.extensions.tags.foreignSingleFieldName
				}

				if (relation.extensions?.tags?.foreignFieldName) {
					return relation.extensions.tags.foreignFieldName
				}

				const fieldName = pluralProperNounFieldName(relation.remoteResource.codec)
				if (fieldName) {
					return fieldName
				}

				return previous?.(details) ?? ''
			},
			singleRelationBackwards(
				this: Inflector,
				previous: ((details: RelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: RelationDetails,
			) {
				const relation =
					details.registry.pgRelations[details.codec.name]?.[details.relationName]

				if (!relation) {
					return previous?.(details) ?? ''
				}

				if (relation.extensions?.tags?.foreignSingleFieldName) {
					return relation.extensions.tags.foreignSingleFieldName
				}

				if (relation.extensions?.tags?.foreignFieldName) {
					return relation.extensions.tags.foreignFieldName
				}

				const fieldName = pluralProperNounFieldName(relation.remoteResource.codec)
				if (fieldName) {
					return fieldName
				}

				return previous?.(details) ?? ''
			},
			_manyRelation(
				this: Inflector,
				previous: ((details: RelationDetails) => string) | undefined,
				_options: GraphileConfig.ResolvedPreset,
				details: RelationDetails,
			) {
				const relation =
					details.registry.pgRelations[details.codec.name]?.[details.relationName]

				if (!relation) {
					return previous?.(details) ?? ''
				}

				if (relation?.extensions?.tags?.foreignFieldName) {
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
				return renameUserPointRelationField(fields)
			},
			GraphQLInputObjectType_fields(fields) {
				return renameUserPointRelationField(fields)
			},
		},
	},
}

export default PgFixForeignKeyNamesPlugin
