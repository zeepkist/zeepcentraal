import type { Inflector, PgTable } from '../types'

export type TaggedPgCodec = {
	name?: string
	extensions?: {
		tags?: {
			name?: string
		}
	}
}

export type PgRelation = {
	remoteResource: { codec: unknown }
	extensions?: {
		tags?: {
			foreignFieldName?: string
			foreignSingleFieldName?: string
		}
	}
}

export type PgRelationDetails = {
	registry: {
		pgRelations: Record<string, Record<string, PgRelation>>
	}
	codec: { name: string }
	relationName: string
}

const pluralProperNounFieldNames = new Map([
	['user_points', 'userPoints'],
	['user_point', 'userPoints'],
	['level_points', 'levelPoints'],
	['level_point', 'levelPoints'],
])

export function getCodecName(codec: unknown) {
	if (!codec || typeof codec !== 'object') {
		return undefined
	}

	const pgCodec = codec as TaggedPgCodec
	return pgCodec.extensions?.tags?.name ?? pgCodec.name
}

export function pluralProperNounFieldName(codec: unknown) {
	const codecName = getCodecName(codec)
	return codecName ? pluralProperNounFieldNames.get(codecName) : undefined
}

export function pluralProperNounTableFieldName(table: PgTable) {
	return pluralProperNounFieldNames.get(table.name)
}

export function getRelation(details: PgRelationDetails) {
	return details.registry.pgRelations[details.codec.name]?.[details.relationName]
}

export function getTaggedRelationFieldName(relation: PgRelation) {
	return (
		relation.extensions?.tags?.foreignSingleFieldName ??
		relation.extensions?.tags?.foreignFieldName
	)
}

export function pascalCase(value: string) {
	return value[0]?.toUpperCase() + value.slice(1)
}

export function relationByJunctionFieldName(
	inflector: Inflector,
	rightTable: PgTable,
	junctionTable: PgTable,
	options?: { simple?: boolean },
) {
	const baseName = inflector.camelCase(
		`${inflector.pluralize(inflector._singularizedTableName(rightTable))}${
			options?.simple ? '-list' : ''
		}`,
	)
	const suffix = pascalCase(inflector.camelCase(inflector._singularizedTableName(junctionTable)))

	return `${baseName}By${suffix}`
}

export function withIgnoredMissingInflectors(
	plugin: GraphileConfig.Plugin,
	inflectors: readonly string[],
) {
	return {
		...plugin,
		inflection: {
			...plugin.inflection,
			ignoreReplaceIfNotExists: [
				...(plugin.inflection?.ignoreReplaceIfNotExists ?? []),
				...inflectors,
			] as never,
		},
	}
}
