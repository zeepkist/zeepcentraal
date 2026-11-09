import type { ExecutableStep } from 'postgraphile/grafast'

const DEFAULT_LIMIT = 100
const MAXIMUM_LIMIT = 1000

type PaginationTarget = {
	setFirst(value: unknown): void
	setLast(value: unknown): void
}
type FieldArgs = {
	getRaw(name: string): ExecutableStep<number | null | undefined>
	autoApply(target: unknown): void
}

export const PaginationLimitsPlugin: GraphileConfig.Plugin = {
	name: 'PaginationLimitsPlugin',
	version: '1.0.0',
	after: ['PgFirstLastBeforeAfterArgsPlugin'],
	schema: {
		hooks: {
			GraphQLObjectType_fields_field(field, build, context) {
				const { isPgFieldConnection, isPgFieldSimpleCollection } = context.scope
				if (!(isPgFieldConnection || isPgFieldSimpleCollection) || !field.plan) return field
				const previousPlan = field.plan
				return {
					...field,
					plan: build.EXPORTABLE(
						(previousPlan, isStep, lambda, defaultLimit, maximumLimit) =>
							function planWithPaginationLimits(
								this: unknown,
								...parameters: unknown[]
							) {
								const result = previousPlan.call(
									this,
									parameters[0] as never,
									parameters[1] as never,
									parameters[2] as never,
								)
								if (
									!isStep(result) ||
									!('setFirst' in result) ||
									!('setLast' in result)
								)
									return result
								const args = parameters[1] as FieldArgs
								args.autoApply(result)
								const target = result as unknown as PaginationTarget
								const first = args.getRaw('first')
								const last = args.getRaw('last')
								target.setFirst(
									lambda(
										[first, last],
										([first, last]) => {
											if (first != null && first > maximumLimit)
												throw new Error(
													`Requested 'first' value of ${first} exceeds the limit of ${maximumLimit}`,
												)
											return (
												first ?? (last == null ? defaultLimit : undefined)
											)
										},
										true,
									),
								)
								target.setLast(
									lambda(
										last,
										(value) => {
											if (value != null && value > maximumLimit)
												throw new Error(
													`Requested 'last' value of ${value} exceeds the limit of ${maximumLimit}`,
												)
											return value
										},
										true,
									),
								)
								return result
							},
						[
							previousPlan,
							build.grafast.isStep,
							build.grafast.lambda,
							DEFAULT_LIMIT,
							MAXIMUM_LIMIT,
						],
					),
				}
			},
			GraphQLObjectType_fields_field_args(args, build, context) {
				const { isPgFieldConnection, isPgFieldSimpleCollection } = context.scope
				if (!(isPgFieldConnection || isPgFieldSimpleCollection)) return args
				// Apply both pagination arguments together in the field plan, including omitted/null values.
				const applyPlan = build.EXPORTABLE(() => () => {}, [])
				return {
					...args,
					...(args.first ? { first: { ...args.first, applyPlan } } : {}),
					...(args.last ? { last: { ...args.last, applyPlan } } : {}),
				}
			},
		},
	},
}
