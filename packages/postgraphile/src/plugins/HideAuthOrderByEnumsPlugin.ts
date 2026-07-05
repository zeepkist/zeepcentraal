import type { GraphilePlugin } from '../types'

const AUTH_ORDER_BY_PREFIX = /^AUTHS?_/

export const HideAuthOrderByEnumsPlugin: GraphilePlugin = (builder) => {
	builder.hook<Record<string, unknown>>('GraphQLEnumType:values', (values, _build, context) => {
		if (!context.scope.isPgRowSortEnum) {
			return values
		}

		for (const enumValueName of Object.keys(values)) {
			if (AUTH_ORDER_BY_PREFIX.test(enumValueName)) {
				delete values[enumValueName]
			}
		}

		return values
	})
}
