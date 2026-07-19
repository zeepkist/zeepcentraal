import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type {
	DocumentNode,
	FragmentDefinitionNode,
	GraphQLSchema,
	OperationDefinitionNode,
} from 'postgraphile/graphql'
import {
	buildClientSchema,
	buildSchema,
	getIntrospectionQuery,
	Kind,
	parse,
	print,
	validate,
	visit,
} from 'postgraphile/graphql'

export const DEFAULT_GRAPHQL_SMOKE_URL = 'http://localhost:5000'
export const PRODUCTION_GRAPHQL_SMOKE_URL = 'https://graphql.zeepki.st'
export const GRAPHQL_SMOKE_CLIENT = 'zeepcentraal-rls-smoke@1.0.0'
export const ZRTM_RLS_SMOKE_QUERY = /* GraphQL */ `
	query ZC_RlsZrtmSmoke {
		zRtm(first: 1, pSampleSize: 1) {
			nodes {
				id
			}
		}
	}
`

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Pick<Response, 'headers' | 'json' | 'ok' | 'status' | 'statusText'>>

interface GraphqlErrorPayload {
	extensions?: { code?: unknown } | null
	message?: unknown
}

interface GraphqlResponsePayload {
	data?: unknown
	errors?: GraphqlErrorPayload[]
}

export interface OperationCatalog {
	fragments: ReadonlyMap<string, FragmentDefinitionNode>
	operations: ReadonlyMap<string, OperationDefinitionNode>
}

export interface GraphqlRequestResult {
	data: unknown
	durationMs: number
	queryCost?: string
}

export interface GraphqlRequestOptions {
	client?: string
	endpoint: string
	fetchImpl?: FetchLike
	operationName: string
	query: string
	timeoutMs: number
	variables?: Record<string, unknown>
}

export interface SmokeCliOptions {
	endpoint: string
	production: boolean
	schemaOnly: boolean
	timeoutMs: number
}

export class GraphqlSmokeError extends Error {
	constructor(
		message: string,
		readonly operationName?: string,
	) {
		super(message)
		this.name = 'GraphqlSmokeError'
	}
}

export async function loadOperationCatalog(graphqlDirectory: string): Promise<OperationCatalog> {
	const operations = new Map<string, OperationDefinitionNode>()
	const fragments = new Map<string, FragmentDefinitionNode>()

	for (const file of await filesUnder(graphqlDirectory, '.graphql')) {
		const document = parse(await readFile(file, 'utf8'))
		for (const definition of document.definitions) {
			if (definition.kind === Kind.OPERATION_DEFINITION) {
				const name = definition.name?.value
				if (!name) throw new GraphqlSmokeError(`Anonymous operation in ${file}`)
				insertUnique(operations, name, definition, 'operation')
			}
			if (definition.kind === Kind.FRAGMENT_DEFINITION) {
				insertUnique(fragments, definition.name.value, definition, 'fragment')
			}
		}
	}

	return { fragments, operations }
}

export function operationDocument(catalog: OperationCatalog, operationName: string): DocumentNode {
	const operation = catalog.operations.get(operationName)
	if (!operation) throw new GraphqlSmokeError(`Unknown web operation ${operationName}`)

	const definitions: Array<OperationDefinitionNode | FragmentDefinitionNode> = [operation]
	const pending = fragmentSpreads(operation)
	const included = new Set<string>()

	while (pending.length > 0) {
		const name = pending.pop()
		if (!name || included.has(name)) continue
		const fragment = catalog.fragments.get(name)
		if (!fragment) {
			throw new GraphqlSmokeError(
				`Operation ${operationName} references missing fragment ${name}`,
				operationName,
			)
		}
		included.add(name)
		definitions.push(fragment)
		pending.push(...fragmentSpreads(fragment))
	}

	return { kind: Kind.DOCUMENT, definitions }
}

export function validateOperationCatalog(
	schema: GraphQLSchema,
	catalog: OperationCatalog,
): string[] {
	const failures: string[] = []
	for (const operationName of [...catalog.operations.keys()].sort()) {
		for (const error of validate(schema, operationDocument(catalog, operationName))) {
			failures.push(`${operationName}: ${error.message}`)
		}
	}
	return failures
}

export async function loadPublishedSchema(schemaPath: string): Promise<GraphQLSchema> {
	return buildSchema(await readFile(schemaPath, 'utf8'))
}

export async function loadEndpointSchema(
	options: Omit<GraphqlRequestOptions, 'operationName' | 'query' | 'variables'>,
): Promise<{ durationMs: number; schema: GraphQLSchema }> {
	const result = await requestGraphql({
		...options,
		operationName: 'IntrospectionQuery',
		query: getIntrospectionQuery({
			descriptions: false,
			directiveIsRepeatable: true,
			inputValueDeprecation: true,
			schemaDescription: false,
			specifiedByUrl: true,
		}),
	})
	if (!isObject(result.data) || !isObject(result.data.__schema)) {
		throw new GraphqlSmokeError('IntrospectionQuery returned no schema', 'IntrospectionQuery')
	}

	return {
		durationMs: result.durationMs,
		schema: buildClientSchema(result.data as never),
	}
}

export async function requestGraphql({
	client = GRAPHQL_SMOKE_CLIENT,
	endpoint,
	fetchImpl = fetch,
	operationName,
	query,
	timeoutMs,
	variables,
}: GraphqlRequestOptions): Promise<GraphqlRequestResult> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	const startedAt = performance.now()

	try {
		const response = await fetchImpl(endpoint, {
			body: JSON.stringify({ operationName, query, variables }),
			headers: {
				'Content-Type': 'application/json',
				'X-Client': client,
			},
			method: 'POST',
			signal: controller.signal,
		})
		const durationMs = Math.round(performance.now() - startedAt)
		const payload = await parseResponsePayload(response, operationName)

		if (!response.ok) {
			throw new GraphqlSmokeError(
				`${operationName} failed with HTTP ${response.status} ${response.statusText}`.trim(),
				operationName,
			)
		}
		if (payload.errors?.length) {
			const messages = payload.errors.map(formatGraphqlError).join('; ')
			throw new GraphqlSmokeError(
				`${operationName} returned GraphQL errors: ${messages}`,
				operationName,
			)
		}
		if (payload.data === undefined) {
			throw new GraphqlSmokeError(`${operationName} returned no data`, operationName)
		}

		return {
			data: payload.data,
			durationMs,
			queryCost: response.headers.get('X-Query-Cost') ?? undefined,
		}
	} catch (error) {
		if (controller.signal.aborted) {
			throw new GraphqlSmokeError(
				`${operationName} timed out after ${timeoutMs}ms`,
				operationName,
			)
		}
		if (error instanceof GraphqlSmokeError) throw error
		throw new GraphqlSmokeError(
			`${operationName} request failed: ${safeErrorMessage(error)}`,
			operationName,
		)
	} finally {
		clearTimeout(timeout)
	}
}

export function parseSmokeCliArguments(arguments_: string[]): SmokeCliOptions {
	let endpoint = DEFAULT_GRAPHQL_SMOKE_URL
	let production = false
	let schemaOnly = false
	let timeoutMs = 15_000

	for (let index = 0; index < arguments_.length; index++) {
		const argument = arguments_[index]
		if (argument === '--production') {
			production = true
			endpoint = PRODUCTION_GRAPHQL_SMOKE_URL
			continue
		}
		if (argument === '--schema-only') {
			schemaOnly = true
			continue
		}
		if (argument === '--url') {
			endpoint = readArgumentValue(arguments_, ++index, '--url')
			continue
		}
		if (argument === '--timeout-ms') {
			const value = Number(readArgumentValue(arguments_, ++index, '--timeout-ms'))
			if (!Number.isSafeInteger(value) || value < 100) {
				throw new GraphqlSmokeError('--timeout-ms must be an integer of at least 100')
			}
			timeoutMs = value
			continue
		}
		throw new GraphqlSmokeError(`Unknown argument ${argument}`)
	}

	const url = normalizeGraphqlEndpoint(endpoint)
	if (url.hostname === new URL(PRODUCTION_GRAPHQL_SMOKE_URL).hostname && !production) {
		throw new GraphqlSmokeError('Production endpoint requires explicit --production')
	}

	return { endpoint: url.toString(), production, schemaOnly, timeoutMs }
}

export function normalizeGraphqlEndpoint(endpoint: string): URL {
	let url: URL
	try {
		url = new URL(endpoint)
	} catch {
		throw new GraphqlSmokeError(`Invalid GraphQL endpoint ${endpoint}`)
	}
	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new GraphqlSmokeError('GraphQL endpoint must use HTTP or HTTPS')
	}
	url.pathname = url.pathname.replace(/\/+$/, '') || '/'
	url.search = ''
	url.hash = ''
	return url
}

export function requireObjectAtPath(value: unknown, path: string[]): Record<string, unknown> {
	let current = value
	for (const segment of path) {
		if (!isObject(current)) throw new GraphqlSmokeError(`Missing public seed ${path.join('.')}`)
		current = current[segment]
	}
	if (!isObject(current)) throw new GraphqlSmokeError(`Missing public seed ${path.join('.')}`)
	return current
}

export function requireScalar(
	value: Record<string, unknown>,
	field: string,
	type: 'number' | 'string',
): number | string {
	const scalar = value[field]
	if (typeof scalar !== type) throw new GraphqlSmokeError(`Missing public seed field ${field}`)
	return scalar as number | string
}

function fragmentSpreads(definition: OperationDefinitionNode | FragmentDefinitionNode): string[] {
	const names: string[] = []
	visit(definition, {
		FragmentSpread(node) {
			names.push(node.name.value)
		},
	})
	return names
}

async function filesUnder(path: string, extension: string): Promise<string[]> {
	const entries = await readdir(path, { withFileTypes: true })
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = join(path, entry.name)
			if (entry.isDirectory() && entry.name !== 'generated') {
				return filesUnder(fullPath, extension)
			}
			return extname(entry.name) === extension ? [fullPath] : []
		}),
	)
	return files.flat().sort()
}

function insertUnique<T>(map: Map<string, T>, name: string, value: T, kind: string): void {
	if (map.has(name)) throw new GraphqlSmokeError(`Duplicate ${kind} ${name}`)
	map.set(name, value)
}

async function parseResponsePayload(
	response: Pick<Response, 'json'>,
	operationName: string,
): Promise<GraphqlResponsePayload> {
	try {
		const payload = await response.json()
		return isObject(payload) ? (payload as GraphqlResponsePayload) : {}
	} catch {
		throw new GraphqlSmokeError(`${operationName} returned non-JSON response`, operationName)
	}
}

function formatGraphqlError(error: GraphqlErrorPayload): string {
	const message = typeof error.message === 'string' ? error.message : 'Unknown GraphQL error'
	const code = typeof error.extensions?.code === 'string' ? ` [${error.extensions.code}]` : ''
	return `${message}${code}`
}

function safeErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return 'Unknown transport error'
}

function readArgumentValue(arguments_: string[], index: number, option: string): string {
	const value = arguments_[index]
	if (!value || value.startsWith('--')) throw new GraphqlSmokeError(`${option} requires a value`)
	return value
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function printOperation(catalog: OperationCatalog, operationName: string): string {
	return print(operationDocument(catalog, operationName))
}
