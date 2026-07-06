export const LiveQueryCompatPlugin: GraphileConfig.Plugin = {
	name: 'LiveQueryCompatPlugin',
	version: '1.0.0',
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields, _build, context) {
				if (context.scope.isRootQuery) {
					rootQueryFieldsByBuild.set(_build, fields)
					return fields
				}

				if (!context.scope.isRootSubscription) {
					return fields
				}

				const rootQueryFields = rootQueryFieldsByBuild.get(_build)
				return rootQueryFields
					? ({ ...rootQueryFields } as typeof fields)
					: withoutListen(fields)
			},
		},
	},
}

const rootQueryFieldsByBuild = new WeakMap<object, unknown>()

function withoutListen<TFields extends Record<string, unknown>>(fields: TFields): TFields {
	const next = { ...fields }
	delete next.listen
	return next as TFields
}
