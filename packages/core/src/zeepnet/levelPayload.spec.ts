import { describe, expect, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'
import { decodeZeepkistLevelPayload, encodeZeepkistLevelPayload } from './levelPayload'

describe('Zeepkist level payload encoding', () => {
	test('matches V18 legacy File.ReadAllLines framing', () => {
		const payload = encodeZeepkistLevelPayload('one\r\ntwø\r\n', false)
		expect(gunzipSync(payload).toString('base64')).toBe('AgAAAANvbmUEdHfDuA==')
		expect(decodeZeepkistLevelPayload(payload)).toEqual(['one', 'twø'])
	})

	test('matches V18 V15 raw-text split semantics', () => {
		const payload = encodeZeepkistLevelPayload('one\r\ntwø\n', true)
		expect(gunzipSync(payload).toString('base64')).toBe('AwAAAARvbmUNBHR3w7gA')
		expect(decodeZeepkistLevelPayload(payload)).toEqual(['one\r', 'twø', ''])
	})

	test('rejects malformed gzip data', () => {
		expect(() => decodeZeepkistLevelPayload(Uint8Array.of(1, 2, 3))).toThrow()
	})

	test('matches StreamReader BOM removal', () => {
		expect(
			decodeZeepkistLevelPayload(encodeZeepkistLevelPayload('\uFEFFfirst\n', true)),
		).toEqual(['first', ''])
	})
})
