import { beforeEach, describe, expect, it } from 'vitest'
import type { GhostRecordSource, ParsedPlaybackGhost } from '../../app/types/ghost'
import { clearGhostBinaryCache, putGhostBinary } from '../../app/utils/ghostBinaryCache.client'
import {
	assertAllowedGhostUrl,
	loadGhostBinary,
	parseGhostCdnOrigins,
} from '../../app/utils/ghostDownload.client'

const allowed = parseGhostCdnOrigins('https://cdn.zeepki.st, https://ghosts.example.test')
const parsed: ParsedPlaybackGhost = {
	version: 6,
	metadata: { steamId: null, taggedUsername: null, color: null, cosmetics: null },
	capabilities: {
		inputs: true,
		air: true,
		wheels: true,
		slip: true,
		state: true,
		surfaces: true,
		velocity: true,
		ragdoll: true,
		orientation: true,
	},
	frames: [],
}

function source(recordId: number): GhostRecordSource {
	return {
		recordId,
		levelId: 1,
		userId: 2,
		userSteamId: '76561198000000000',
		userName: 'Player',
		time: 10,
		dateCreated: '2026-07-18T00:00:00Z',
		ghostUrl: `https://cdn.zeepki.st/ghosts/${recordId}.bin?signature=secret`,
		mediaRevision: 'revision-one',
		isWorldRecord: false,
		isPersonalBest: true,
	}
}

describe('direct ghost downloads', () => {
	beforeEach(async () => {
		await clearGhostBinaryCache()
	})

	it('allows configured CDN origins and rejects other hosts', () => {
		expect(assertAllowedGhostUrl('https://cdn.zeepki.st/ghosts/1', allowed).hostname).toBe(
			'cdn.zeepki.st',
		)
		expect(() => assertAllowedGhostUrl('https://attacker.example/ghost', allowed)).toThrow(
			'not trusted',
		)
	})

	it('resolves stored relative ghost paths against configured CDN', () => {
		expect(assertAllowedGhostUrl('ghosts/example.bin', allowed).href).toBe(
			'https://cdn.zeepki.st/ghosts/example.bin',
		)
		expect(() => assertAllowedGhostUrl('//attacker.example/ghost', allowed)).toThrow(
			'not trusted',
		)
	})

	it('downloads directly, parses before caching, then reads raw bytes from cache', async () => {
		let fetchCount = 0
		const fetch = async () => {
			fetchCount++
			return new Response(new Uint8Array([6, 1, 2]), {
				status: 200,
				headers: { 'content-length': '3', etag: 'one' },
			})
		}
		const parse = async (buffer: ArrayBuffer) => {
			expect(new Uint8Array(buffer)[0]).toBe(6)
			return parsed
		}
		const first = await loadGhostBinary(source(901), allowed, { fetch, parse })
		const second = await loadGhostBinary(source(901), allowed, { fetch, parse })

		expect(first).toMatchObject({ source: 'network', byteLength: 3 })
		expect(second).toMatchObject({ source: 'cache', byteLength: 3 })
		expect(fetchCount).toBe(1)
	})

	it('deletes corrupt cached bytes and retries CDN once', async () => {
		const record = source(902)
		await putGhostBinary({
			recordId: record.recordId,
			blob: new Blob([new Uint8Array([0])]),
			sourceKey: `https://cdn.zeepki.st/ghosts/${record.recordId}.bin`,
			mediaRevision: 'revision-one',
		})
		let fetchCount = 0
		const result = await loadGhostBinary(record, allowed, {
			fetch: async () => {
				fetchCount++
				return new Response(new Uint8Array([6]))
			},
			parse: async (buffer) => {
				if (new Uint8Array(buffer)[0] === 0) throw new Error('corrupt')
				return parsed
			},
		})

		expect(result.source).toBe('network')
		expect(fetchCount).toBe(1)
	})
})
