import { lt, valid } from 'semver'
import type { ElysiaGrafserv } from './elysiaGrafserv'

const versionBody = {
	operationName: 'ZC_GtrVersions',
	query: 'query ZC_GtrVersions { versions(first: 1, orderBy: ID_ASC) { nodes { minimum latest } } }',
}

type Versions = { minimum: string; latest: string }
type VersionResponse = {
	data?: { versions?: { nodes?: { minimum?: unknown; latest?: unknown }[] } }
	errors?: unknown[]
}

function parseVersion(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined
	const value = input.trim()
	if (!valid(value)) return undefined
	// Preserve build metadata in the update message.
	return value.startsWith('v') ? value.slice(1) : value
}

export type GtrUpdateMessageProvider = (headers: Headers) => Promise<string | undefined>

export function createGtrUpdateMessageProvider(
	server: Pick<ElysiaGrafserv, 'handleGraphQLRequest'>,
	now = Date.now,
): GtrUpdateMessageProvider {
	let cached: Versions | undefined
	let expiresAt = 0
	let pending: Promise<void> | undefined

	async function refresh() {
		let versions: Versions | undefined
		try {
			const response = await server.handleGraphQLRequest(
				new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
				}),
				versionBody,
			)
			if (response?.ok) {
				const payload = (await response.json()) as VersionResponse | null
				const row = payload?.data?.versions?.nodes?.[0]
				const minimum = parseVersion(row?.minimum)
				const latest = parseVersion(row?.latest)
				if (!payload?.errors?.length && minimum && latest) versions = { minimum, latest }
			}
		} catch {
			// Version lookup must never reject an otherwise valid GraphQL request.
		}
		cached = versions
		expiresAt = now() + (versions ? 60 * 60 * 1000 : 30 * 1000)
	}

	return async (headers) => {
		const current = parseVersion(headers.get('X-GTR-Version'))
		if (!current) return undefined

		if (now() >= expiresAt) {
			pending ??= refresh().finally(() => {
				pending = undefined
			})
			await pending
		}
		return cached && lt(current, cached.minimum) ? `Update GTR to ${cached.latest}` : undefined
	}
}
