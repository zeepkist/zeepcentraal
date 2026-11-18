import { wrapPlans } from 'postgraphile/utils'

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
	({ scope }, build) => (scope.fieldName === 'steamName' ? build.grafast : null),
	({ constant, context, lambda }) =>
		(plan, $source, fieldArgs, info) => {
			const $value = plan($source, fieldArgs, info) ?? constant(null)
			const $message = context().get('gtrUpdateMessage')
			return lambda([$value, $message], ([value, message]) => message ?? value)
		},
	{
		name: 'GtrUpdateMessagePlugin',
		version: '1.0.0',
		disableResolverEmulationWarnings: true,
	},
)
