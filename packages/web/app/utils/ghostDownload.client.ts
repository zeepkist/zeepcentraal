import type { GhostRecordSource, ParsedPlaybackGhost } from '~/types/ghost'
import {
	createGhostBinarySourceKey,
	deleteGhostBinary,
	getGhostBinary,
	putGhostBinary,
} from '~/utils/ghostBinaryCache.client'

const MAXIMUM_GHOST_BYTES = 64 * 1024 * 1024
const inFlight = new Map<string, Promise<LoadedGhostBinary>>()

export type LoadedGhostBinary = {
	ghost: ParsedPlaybackGhost
	source: 'cache' | 'network'
	byteLength: number
}

export type GhostDownloadDependencies = {
	parse: (buffer: ArrayBuffer) => Promise<ParsedPlaybackGhost>
	fetch?: typeof globalThis.fetch
}

export function parseGhostCdnOrigins(value: string): Set<string> {
	return new Set(
		value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) => new URL(entry).origin),
	)
}

export function assertAllowedGhostUrl(value: string, allowedOrigins: ReadonlySet<string>): URL {
	const url = new URL(value)
	if (url.protocol !== 'https:' && !(import.meta.dev && url.protocol === 'http:')) {
		throw new Error('Ghost download URL must use HTTPS')
	}
	if (!allowedOrigins.has(url.origin)) throw new Error('Ghost download URL is not trusted')
	return url
}

export function loadGhostBinary(
	record: GhostRecordSource,
	allowedOrigins: ReadonlySet<string>,
	dependencies: GhostDownloadDependencies,
): Promise<LoadedGhostBinary> {
	if (!record.ghostUrl) return Promise.reject(new Error('Record has no ghost replay'))
	const url = assertAllowedGhostUrl(record.ghostUrl, allowedOrigins)
	const revision = {
		sourceKey: createGhostBinarySourceKey(url),
		mediaRevision: record.mediaRevision ?? record.dateCreated,
	}
	const key = `${record.recordId}:${revision.sourceKey}:${revision.mediaRevision}`
	const existing = inFlight.get(key)
	if (existing) return existing
	const promise = loadGhostBinaryUncached(record.recordId, url, revision, dependencies).finally(
		() => {
			inFlight.delete(key)
		},
	)
	inFlight.set(key, promise)
	return promise
}

async function loadGhostBinaryUncached(
	recordId: number,
	url: URL,
	revision: { sourceKey: string; mediaRevision: string },
	dependencies: GhostDownloadDependencies,
): Promise<LoadedGhostBinary> {
	const cached = await getGhostBinary(recordId, revision)
	if (cached) {
		try {
			return {
				ghost: await dependencies.parse(await cached.blob.arrayBuffer()),
				source: 'cache',
				byteLength: cached.byteLength,
			}
		} catch {
			await deleteGhostBinary(recordId)
		}
	}

	const response = await (dependencies.fetch ?? globalThis.fetch)(url, {
		method: 'GET',
		mode: 'cors',
		credentials: 'omit',
		redirect: 'error',
		referrerPolicy: 'no-referrer',
	})
	if (!response.ok) throw new Error(`Ghost download failed with HTTP ${response.status}`)
	const announcedLength = Number(response.headers.get('content-length'))
	if (Number.isFinite(announcedLength) && announcedLength > MAXIMUM_GHOST_BYTES) {
		throw new Error('Ghost replay exceeds download limit')
	}
	const blob = await response.blob()
	if (blob.size === 0) throw new Error('Ghost replay is empty')
	if (blob.size > MAXIMUM_GHOST_BYTES) throw new Error('Ghost replay exceeds download limit')
	const ghost = await dependencies.parse(await blob.arrayBuffer())
	await putGhostBinary({
		recordId,
		blob,
		...revision,
		etag: response.headers.get('etag'),
	})
	return { ghost, source: 'network', byteLength: blob.size }
}
