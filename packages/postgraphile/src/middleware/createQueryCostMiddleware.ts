import {
	getTracer,
	recordSpanWarning,
	setSpanErrorStatus,
	setSpanOkStatus,
} from '@zeepkist/telemetry'
import {
	type ArgumentNode,
	type DocumentNode,
	type FragmentDefinitionNode,
	parse,
	type SelectionNode,
	type ValueNode,
} from 'graphql'

const FLATTENED_FIELDS_NO_DEPTH = new Set([
	'nodes',
	'edges',
	'keys',
	'aggregates',
	'groupedAggregates',
	'speeds',
	'splits',
	'blocks',
	'amountBlocks',
	'amountCheckpoints',
	'amountFinishes',
	'numRecords',
	'points',
	'totalPoints',
	'worldRecords',
])

type GraphQlBody = {
	query?: unknown
	operationName?: unknown
	variables?: unknown
}

export type QueryCostResult = {
	response?: Response
	cost?: number
}

function getArgValue(valueNode: ValueNode) {
	switch (valueNode.kind) {
		case 'IntValue':
			return Number.parseInt(valueNode.value, 10)
		case 'FloatValue':
			return Number.parseFloat(valueNode.value)
		case 'StringValue':
			return valueNode.value
		case 'BooleanValue':
			return valueNode.value
		default:
			return undefined
	}
}

function getPaginationMultiplier(args: readonly ArgumentNode[], defaultSize: number) {
	const firstArg = args.find((arg) => arg.name.value === 'first')
	const lastArg = args.find((arg) => arg.name.value === 'last')

	const first = firstArg ? getArgValue(firstArg.value) : undefined
	const last = lastArg ? getArgValue(lastArg.value) : undefined

	return first ?? last ?? defaultSize
}

function shouldIncreaseDepth(fieldName: string) {
	return !FLATTENED_FIELDS_NO_DEPTH.has(fieldName) && !fieldName.startsWith('__')
}

function isManyToMany(fieldName: string) {
	const parts = fieldName.split('By')
	return parts.length > 1 && (parts[0]?.endsWith('s') ?? false)
}

function isCollectionField(fieldName: string, args: readonly ArgumentNode[]) {
	if (FLATTENED_FIELDS_NO_DEPTH.has(fieldName)) {
		return false
	}

	const hasPaginationArgs = args.some(
		(arg) => arg.name.value === 'first' || arg.name.value === 'last',
	)
	const isPlural = fieldName.endsWith('s')

	return hasPaginationArgs || isPlural || isManyToMany(fieldName)
}

function containsIntrospectionField(selections: readonly SelectionNode[]): boolean {
	for (const selection of selections) {
		if (selection.kind === 'Field') {
			const name = selection.name.value
			if (name === '__schema' || name === '__type') {
				return true
			}
		} else if (selection.kind === 'InlineFragment') {
			if (containsIntrospectionField(selection.selectionSet.selections)) {
				return true
			}
		}
	}

	return false
}

function estimateSelectionsCost(
	selections: readonly SelectionNode[],
	depth = 1,
	parentMultiplier = 1,
	fragments: Record<string, FragmentDefinitionNode> = {},
	visitedFragments = new Set<string>(),
	defaultCollectionSize = 1000,
) {
	let cost = 0

	for (const selection of selections) {
		switch (selection.kind) {
			case 'Field': {
				const fieldName = selection.name.value
				const args = selection.arguments ?? []
				const isCollection = isCollectionField(fieldName, args)
				const multiplier = isCollection
					? getPaginationMultiplier(args, defaultCollectionSize)
					: 1
				const totalMultiplier = parentMultiplier * Math.log2(Number(multiplier) + 1)
				const effectiveDepth = shouldIncreaseDepth(fieldName) ? depth : depth - 1

				cost += totalMultiplier * Math.max(1, effectiveDepth)

				if (selection.selectionSet) {
					cost += estimateSelectionsCost(
						selection.selectionSet.selections,
						effectiveDepth + 1,
						totalMultiplier,
						fragments,
						visitedFragments,
						defaultCollectionSize,
					)
				}
				break
			}
			case 'FragmentSpread': {
				const fragmentName = selection.name.value
				if (!visitedFragments.has(fragmentName)) {
					visitedFragments.add(fragmentName)
					const fragment = fragments[fragmentName]
					if (fragment) {
						cost += estimateSelectionsCost(
							fragment.selectionSet.selections,
							depth,
							parentMultiplier,
							fragments,
							visitedFragments,
							defaultCollectionSize,
						)
					}
					visitedFragments.delete(fragmentName)
				}
				break
			}
			case 'InlineFragment':
				cost += estimateSelectionsCost(
					selection.selectionSet.selections,
					depth,
					parentMultiplier,
					fragments,
					visitedFragments,
					defaultCollectionSize,
				)
				break
		}
	}

	return cost
}

export function estimateQueryCost(
	document: DocumentNode,
	operationName?: string,
	defaultCollectionSize = 1000,
) {
	const fragments: Record<string, FragmentDefinitionNode> = Object.create(null)
	for (const definition of document.definitions) {
		if (definition.kind === 'FragmentDefinition') {
			fragments[definition.name.value] = definition
		}
	}

	let totalCost = 0
	const namedOperation = document.definitions.find(
		(definition) =>
			definition.kind === 'OperationDefinition' && definition.name?.value === operationName,
	)

	if (operationName && namedOperation?.kind === 'OperationDefinition') {
		totalCost += estimateSelectionsCost(
			namedOperation.selectionSet.selections,
			1,
			1,
			fragments,
			new Set(),
			defaultCollectionSize,
		)
	} else {
		for (const definition of document.definitions) {
			if (definition.kind === 'OperationDefinition') {
				totalCost += estimateSelectionsCost(
					definition.selectionSet.selections,
					1,
					1,
					fragments,
					new Set(),
					defaultCollectionSize,
				)
			}
		}
	}

	return Math.ceil(totalCost)
}

export async function evaluateQueryCost(
	body: GraphQlBody | undefined,
	maxCost = 5000,
	defaultCollectionSize = 100,
	includeQueryTraceDetail = false,
): Promise<QueryCostResult> {
	if (typeof body?.query !== 'string') {
		return {}
	}

	const startTime = performance.now()
	const tracer = getTracer()
	const operationName = typeof body.operationName === 'string' ? body.operationName : undefined
	const { query, variables } = body

	return tracer.startActiveSpan('GraphQL Query Cost Estimation', async (span) => {
		let document: DocumentNode
		let parseElapsedMs = 0

		try {
			const parseStartTime = performance.now()
			document = parse(query, {
				noLocation: true,
				allowLegacySDLEmptyFields: false,
				allowLegacySDLImplementsInterfaces: false,
			})
			parseElapsedMs = performance.now() - parseStartTime
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			recordSpanWarning('Invalid GraphQL Syntax', {
				'graphql.operation.name': operationName || 'default',
				'graphql.error.kind': 'syntax',
				'graphql.error.message': message,
			})
			span.end()
			return {
				response: Response.json(
					{
						errors: [{ message: 'Invalid GraphQL Syntax', details: message }],
					},
					{ status: 400 },
				),
			}
		}

		for (const definition of document.definitions) {
			if (
				definition.kind === 'OperationDefinition' &&
				containsIntrospectionField(definition.selectionSet.selections)
			) {
				span.end()
				return {}
			}
		}

		const costStartTime = performance.now()
		const totalCost = estimateQueryCost(document, operationName, defaultCollectionSize)
		const costElapsedMs = performance.now() - costStartTime

		const elapsedMs = performance.now() - startTime

		span.setAttribute('graphql.queryCost.cost', totalCost)
		span.setAttribute('graphql.queryCost.operationName', operationName || 'default')
		span.setAttribute('graphql.queryCost.elapsedMs', elapsedMs)
		span.setAttribute('graphql.queryCost.parseElapsedMs', parseElapsedMs)
		span.setAttribute('graphql.queryCost.costElapsedMs', costElapsedMs)
		span.setAttribute('graphql.queryCost.exceeded', totalCost > maxCost)

		if (includeQueryTraceDetail) {
			span.setAttribute('graphql.queryCost.query', query)

			if (variables && typeof variables === 'object') {
				span.setAttributes(
					Object.entries(variables).reduce<Record<string, string>>(
						(acc, [key, value]) => {
							acc[`graphql.queryCost.variables.${key}`] = JSON.stringify(value)
							return acc
						},
						{},
					),
				)
			}
		}

		if (totalCost > maxCost) {
			recordSpanWarning('Query Cost Exceeded', {
				'graphql.operation.name': operationName || 'default',
				'graphql.queryCost.cost': totalCost,
				'graphql.queryCost.maxCost': maxCost,
			})
			setSpanErrorStatus(span, `Query cost exceeded: ${totalCost} > ${maxCost}`)
			span.end()
			return {
				response: Response.json(
					{
						errors: [
							{
								message: 'Query Cost Exceeded',
								details: `Estimated cost: ${totalCost} > ${maxCost}. Optimsise your query by using pagination, reducing field depth and limiting requested fields per selection to fetch only the data you need.`,
							},
						],
					},
					{
						status: 400,
						headers: {
							'X-Query-Cost': String(totalCost),
						},
					},
				),
			}
		}

		setSpanOkStatus(span)
		span.end()
		return { cost: totalCost }
	})
}
