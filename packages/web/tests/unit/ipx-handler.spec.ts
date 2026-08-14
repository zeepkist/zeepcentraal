import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	createIpxWebHandler,
	resolveIpxFsDirectories,
	stripIpxBaseURL,
} from '../../server/utils/ipx'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

describe('IPX web handler', () => {
	it('strips the configured base URL and preserves the query', () => {
		expect(
			stripIpxBaseURL(
				'https://zeepki.st/_ipx/f_avif&s_64x64/android-chrome-192x192.png?v=1',
				'/_ipx',
			),
		).toBe('https://zeepki.st/f_avif&s_64x64/android-chrome-192x192.png?v=1')
		expect(stripIpxBaseURL('https://zeepki.st/_ipx', '/_ipx')).toBe('https://zeepki.st/')
	})

	it('resolves relative and absolute filesystem directories', () => {
		expect(resolveIpxFsDirectories('../public', import.meta.url)).toEqual([
			fileURLToPath(new URL('../public', import.meta.url)),
		])
		expect(resolveIpxFsDirectories(publicDir, import.meta.url)).toEqual([publicDir])
	})

	it('transforms a local image through the Fetch API', async () => {
		const handler = createIpxWebHandler({
			baseURL: '/_ipx',
			fs: { dir: publicDir },
			http: false,
		})
		const response = await handler(
			new Request('https://zeepki.st/_ipx/f_avif&s_64x64/android-chrome-192x192.png'),
		)

		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toBe('image/avif')
		expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
	})

	it('returns not found for a missing local image', async () => {
		const handler = createIpxWebHandler({
			baseURL: '/_ipx',
			fs: { dir: publicDir },
			http: false,
		})
		const response = await handler(new Request('https://zeepki.st/_ipx/_/missing-image.png'))

		expect(response.status).toBe(404)
	})

	it('rejects missing storage configuration', () => {
		expect(() =>
			createIpxWebHandler({
				baseURL: '/_ipx',
				fs: false,
				http: false,
			}),
		).toThrow('IPX storage is not configured!')
	})
})
