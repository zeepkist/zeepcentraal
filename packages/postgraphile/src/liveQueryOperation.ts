import {
	type DocumentNode,
	type GraphQLSchema,
	type OperationDefinitionNode,
	parse,
	print,
	validate,
} from 'postgraphile/graphql'
import type { GraphqlPayload } from './liveQueryProtocol'

type PrepareResult =
	| {
			query: string
	  }
	| {
			error: string
	  }

export async function prepareLiveQuery(
	schema: GraphQLSchema | Promise<GraphQLSchema>,
	payload: GraphqlPayload,
): Promise<PrepareResult> {
	try {
		const document = parse(payload.query)
		const operation = findOperation(document, payload.operationName)
		if (!operation) {
			return { error: 'GraphQL operation not found' }
		}

		if (operation.operation !== 'subscription') {
			return { error: 'Live query websocket only accepts subscription operations' }
		}

		const validationErrors = validate(await schema, document)
		if (validationErrors.length > 0) {
			return { error: validationErrors[0]?.message ?? 'Invalid GraphQL subscription' }
		}

		return { query: print(rewriteSubscriptionAsQuery(document, operation)) }
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Invalid GraphQL subscription',
		}
	}
}

function findOperation(document: DocumentNode, operationName: unknown) {
	const operations = document.definitions.filter(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === 'OperationDefinition',
	)

	if (typeof operationName === 'string') {
		return operations.find((operation) => operation.name?.value === operationName)
	}

	return operations.length === 1 ? operations[0] : undefined
}

function rewriteSubscriptionAsQuery(
	document: DocumentNode,
	selectedOperation: OperationDefinitionNode,
): DocumentNode {
	return {
		...document,
		definitions: document.definitions.map((definition) => {
			if (definition !== selectedOperation) {
				return definition
			}

			return {
				...definition,
				operation: 'query',
			} as OperationDefinitionNode
		}),
	}
}
