import type { GraphilePlugin } from '../types'

export const SkipByNodeIdFieldsPlugin: GraphilePlugin = (builder) => {
	builder.hook<Record<string, unknown>>('GraphQLObjectType:fields', (fields, _build, context) => {
		if (context.scope.isRootQuery) {
			for (const fieldName of Object.keys(fields)) {
				if (fieldName.endsWith('ByNodeId')) {
					delete fields[fieldName]
				}
			}
		}

		return fields
	})
}
