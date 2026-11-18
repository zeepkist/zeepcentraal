import { GraphQLFloat, isNonNullType } from 'postgraphile/graphql'
import { wrapPlans } from 'postgraphile/utils'

// displays as `01:23.456` in the UI
const UPDATE_TIME = 83.456

declare global {
	namespace Grafast {
		interface RequestContext {
			gtrUpdateMessage?: string
		}
		interface Context {
			gtrUpdateMessage?: string
		}
	}
}

export const GtrUpdateMessagePlugin = wrapPlans(
	({ scope }, { grafast }, field) => {
		if (scope.fieldName === 'steamName') return { grafast, replaceTime: false }
		if (scope.fieldName !== 'time') return null

		// Duration fields are Float. Distinct counts also have a field named time.
		const type = isNonNullType(field.type) ? field.type.ofType : field.type
		return type === GraphQLFloat ? { grafast, replaceTime: true } : null
	},
	({ grafast: { constant, context, lambda }, replaceTime }) =>
		(plan, $source, fieldArgs, info) => {
			const $value = plan($source, fieldArgs, info) ?? constant(null)
			const $message = context().get('gtrUpdateMessage')
			return lambda([$value, $message], ([value, message]) => {
				if (message === undefined) return value
				return replaceTime ? UPDATE_TIME : message
			})
		},
	{
		name: 'GtrUpdateMessagePlugin',
		version: '1.0.0',
		disableResolverEmulationWarnings: true,
	},
)
