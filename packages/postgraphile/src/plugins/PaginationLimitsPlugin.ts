export const PaginationLimitsPlugin: GraphileConfig.Plugin = {
	name: 'PaginationLimitsPlugin',
	version: '1.0.0',
	after: ['PgFirstLastBeforeAfterArgsPlugin'],
	schema: {
		hooks: {
			GraphQLObjectType_fields_field(field, build, context) {
				const { isPgFieldConnection, isPgFieldSimpleCollection } = context.scope

				if (!(isPgFieldConnection || isPgFieldSimpleCollection) || !field.plan) {
					return field
				}

				const { ConstantStep, isStep } = build.grafast
				const { EXPORTABLE } = build
				const previousPlan = field.plan

				return {
					...field,
					plan: EXPORTABLE(
						(ConstantStep, isStep, previousPlan) =>
							function planWithDefaultLimit(this: unknown, ...planParams: unknown[]) {
								const [, fieldArgs] = planParams
								const result = previousPlan.call(
									this,
									planParams[0] as never,
									planParams[1] as never,
									planParams[2] as never,
								)

								if (!isStep(result)) {
									return result
								}

								const args = fieldArgs as FieldArgs
								args.autoApply(result)

								const first = args.getRaw('first')
								const last = args.getRaw('last')
								const firstOmitted =
									first instanceof ConstantStep && first.data === undefined
								const lastOmitted =
									last instanceof ConstantStep && last.data === undefined

								if (firstOmitted && lastOmitted && hasSetFirst(result)) {
									result.setFirst(DEFAULT_LIMIT)
								}

								return result
							},
						[ConstantStep, isStep, previousPlan],
						'planWithDefaultLimit',
					),
				}
			},
			GraphQLObjectType_fields_field_args(args, build, context) {
				const { isPgFieldConnection, isPgFieldSimpleCollection } = context.scope

				if (!(isPgFieldConnection || isPgFieldSimpleCollection)) {
					return args
				}

				const { EXPORTABLE } = build
				const { lambda } = build.grafast

				return {
					...args,
					...(args.first
						? {
								first: {
									...args.first,
									applyPlan: EXPORTABLE(
										(lambda, maximumLimit) =>
											function applyFirstLimit(
												_: unknown,
												target: PaginationTarget,
												arg: FieldArg,
											) {
												target.setFirst(
													(lambda as LambdaFn)(
														arg.getRaw(),
														(value: number | null | undefined) =>
															validateLimit(
																'first',
																value,
																maximumLimit,
															),
														true,
													),
												)
											},
										[lambda, MAXIMUM_LIMIT],
										'applyFirstLimit',
									),
								},
							}
						: null),
					...(args.last
						? {
								last: {
									...args.last,
									applyPlan: EXPORTABLE(
										(lambda, maximumLimit) =>
											function applyLastLimit(
												_: unknown,
												target: PaginationTarget,
												arg: FieldArg,
											) {
												target.setLast(
													(lambda as LambdaFn)(
														arg.getRaw(),
														(value: number | null | undefined) =>
															validateLimit(
																'last',
																value,
																maximumLimit,
															),
														true,
													),
												)
											},
										[lambda, MAXIMUM_LIMIT],
										'applyLastLimit',
									),
								},
							}
						: null),
				}
			},
		},
	},
}

const DEFAULT_LIMIT = 100
const MAXIMUM_LIMIT = 1000

type FieldArg = {
	getRaw(): unknown
}

type LambdaFn = (
	step: unknown,
	callback: (value: number | null | undefined) => number | null | undefined,
	isSyncAndSafe: boolean,
) => unknown

type FieldArgs = {
	getRaw(name: string): unknown
	autoApply(target: unknown): void
}

type PaginationTarget = {
	setFirst(first: unknown): void
	setLast(last: unknown): void
}

function hasSetFirst(value: unknown): value is { setFirst(first: number): void } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'setFirst' in value &&
		typeof value.setFirst === 'function'
	)
}

function validateLimit(name: 'first' | 'last', value: number | null | undefined, maximum: number) {
	if (value != null && value > maximum) {
		throw new Error(`Requested '${name}' value of ${value} exceeds the limit of ${maximum}`)
	}

	return value
}
