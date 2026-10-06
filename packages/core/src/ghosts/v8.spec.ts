import { expect, test } from 'bun:test'
import { decompress } from '@napi-rs/lzma/lzma'
import fixture from '../../../../test/fixtures/ghost-v8.json'
import { parseGhostBrowser } from './browser'
import { parseGhost } from './index'
import { parseDecodedV8 } from './protobufVersions'
import { type RunEvidence, readRunEvidence } from './v8Evidence'

test('shared V8 wire fixture preserves identity, timestamps, telemetry and evidence', async () => {
	const bytes = Uint8Array.fromHex(fixture.lzmaHex)
	const server = await parseGhost(bytes)
	const browser = await parseGhostBrowser(bytes, { decompressLzma: decompress })
	expect(browser).toEqual(server)
	expect(server.version).toBe(8)
	expect(server.metadata.steamId).toBe('42')
	expect(server.frames[0]?.time).toBe(1.2)
	expect(server.frames[1]?.position).toEqual({ x: 1, y: 0, z: 0 })
	expect(server.evidence).toEqual(fixture.evidence as unknown as RunEvidence)
})

test('missing V8 evidence cannot silently fall back to V7', () => {
	expect(() =>
		parseDecodedV8({
			version: 8,
			initialFrame: { position: { x: 0, y: 0, z: 0 } },
			deltaFrames: [],
		}),
	).toThrow('Missing V8 evidence')
})

test('sphere sampling revision remains optional and rejects invalid integers', () => {
	const read = (sphereSamplingVersion: unknown) =>
		readRunEvidence({
			evidenceJson: JSON.stringify({ ...fixture.evidence, sphereSamplingVersion }),
		})
	expect(read(undefined).sphereSamplingVersion).toBeUndefined()
	expect(read(2).sphereSamplingVersion).toBe(2)
	expect(read(3).sphereSamplingVersion).toBe(3)
	for (const revision of [-1, 1.5, 4294967296, null]) expect(() => read(revision)).toThrow()
})
