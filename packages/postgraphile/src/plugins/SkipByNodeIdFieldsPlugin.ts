export const SkipByNodeIdFieldsPlugin: GraphileConfig.Plugin = {
	name: 'SkipByNodeIdFieldsPlugin',
	version: '1.0.0',
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields, _build, context) {
				if (!context.scope.isRootQuery) {
					return fields
				}

				const next = { ...fields }
				for (const fieldName of Object.keys(next)) {
					if (fieldName.endsWith('ByNodeId')) {
						delete next[fieldName]
					}
				}

				return next
			},
		},
	},
}
