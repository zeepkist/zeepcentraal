import type { GraphQLFieldResolver } from 'postgraphile/graphql'

export type GraphileBuilder = {
	hook<TValue>(
		hookName: string,
		callback: (value: TValue, build: unknown, context: GraphileHookContext) => TValue,
	): void
}

export type GraphileHookContext = {
	scope: {
		fieldName?: string
		isPgRowSortEnum?: boolean
		isRootQuery?: boolean
		isRootSubscription?: boolean
	}
}

export type GraphilePlugin = (builder: GraphileBuilder) => void

export type GraphileField = {
	name?: string
	resolve?: GraphQLFieldResolver<Record<string, unknown>, unknown>
	[key: string]: unknown
}

export type Inflector = {
	camelCase(value: string): string
	constantCase(value: string): string
	coerceToGraphQLName(value: string): string
	pluralize(value: string): string
	tableType(codec: unknown): string
	orderByColumnEnum(...args: unknown[]): string
	_singularizedTableName(table: PgTable): string
}

export type PgTable = {
	name: string
}

export type PgConstraint = {
	tags: Record<string, string | undefined>
}
