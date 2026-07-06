const AUTH_ORDER_BY_PREFIX = /^AUTHS?_/

export const HideAuthOrderByEnumsPlugin: GraphileConfig.Plugin = {
	name: 'HideAuthOrderByEnumsPlugin',
	version: '1.0.0',
	schema: {
		hooks: {
			GraphQLEnumType_values(values, _build, context) {
				if (!context.scope.isPgRowSortEnum) {
					return values
				}

				const next = { ...values }
				for (const enumValueName of Object.keys(next)) {
					if (AUTH_ORDER_BY_PREFIX.test(enumValueName)) {
						delete next[enumValueName]
					}
				}

				return next
			},
		},
	},
}
