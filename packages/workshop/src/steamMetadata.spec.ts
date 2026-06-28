import { afterEach, describe, expect, test } from 'bun:test'
import { SteamWebApiMetadata } from './steamMetadata'

const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

function mockJsonResponse(
	handler: (url: URL) => {
		body?: unknown
		status?: number
	},
) {
	const urls: URL[] = []
	globalThis.fetch = (async (input) => {
		const url = new URL(String(input))
		urls.push(url)
		const { body = {}, status = 200 } = handler(url)
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' },
		})
	}) as typeof fetch
	return urls
}

describe('SteamWebApiMetadata', () => {
	test('getItems uses admin query and keeps non-public items available', async () => {
		const urls = mockJsonResponse(() => ({
			body: {
				response: {
					publishedfiledetails: [
						{
							result: 1,
							publishedfileid: '3507841441',
							creator: '76561198041027402',
							title: 'Hidden Level',
							preview_url: 'https://images.example/preview',
							time_created: 100,
							time_updated: 200,
							visibility: 1,
							file_size: '12345',
						},
					],
				},
			},
		}))
		const metadata = new SteamWebApiMetadata('key', '1440670', 'https://steam.test')

		const [item] = await metadata.getItems([3507841441n])

		expect(urls[0]?.searchParams.get('admin_query')).toBe('true')
		expect(item?.available).toBe(true)
		expect(item?.visibility).toBe(1)
		expect(item?.fileSize).toBe(12345)
		expect(item?.createdAt).toBe('1970-01-01T00:01:40.000Z')
		expect(item?.updatedAt).toBe('1970-01-01T00:03:20.000Z')
	})

	test('listItems uses admin query', async () => {
		const urls = mockJsonResponse(() => ({
			body: {
				response: {
					publishedfiledetails: [],
				},
			},
		}))
		const metadata = new SteamWebApiMetadata('key', '1440670', 'https://steam.test')

		await metadata.listItems()

		expect(urls[0]?.searchParams.get('admin_query')).toBe('true')
	})

	test('banned and missing items are unavailable', async () => {
		mockJsonResponse(() => ({
			body: {
				response: {
					publishedfiledetails: [
						{
							result: 1,
							publishedfileid: '3507841441',
							banned: true,
						},
					],
				},
			},
		}))
		const metadata = new SteamWebApiMetadata('key', '1440670', 'https://steam.test')

		const [banned, missing] = await metadata.getItems([3507841441n, 3507841442n])

		expect(banned?.available).toBe(false)
		expect(banned?.permanentFailure).toBe('banned')
		expect(missing?.available).toBe(false)
		expect(missing?.permanentFailure).toBe('missing')
	})
})
