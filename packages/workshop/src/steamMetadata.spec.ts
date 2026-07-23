import { describe, expect, test } from 'bun:test'
import { STEAM_VISIBILITY } from '@zeepkist/core/steam'
import { mockJsonFetch } from '../../../test/fetchMock'
import { SteamWebApiMetadata } from './steamMetadata'

describe('SteamWebApiMetadata', () => {
	test('getItems uses admin query and keeps non-public items available', async () => {
		const urls = mockJsonFetch(() => ({
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
		expect(item?.visibility).toBe(STEAM_VISIBILITY.FriendsOnly)
		expect(item?.fileSize).toBe(12345)
		expect(item?.createdAt).toBe('1970-01-01T00:01:40.000Z')
		expect(item?.updatedAt).toBe('1970-01-01T00:03:20.000Z')
	})

	test('listItems uses admin query', async () => {
		const urls = mockJsonFetch(() => ({
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

	test('listUserItemIds uses uploader-specific endpoint and paginates bigint IDs', async () => {
		const urls = mockJsonFetch((url) => {
			const page = Number(url.searchParams.get('page'))
			return {
				body: {
					response: {
						total: 3,
						startindex: page === 1 ? 1 : 3,
						publishedfiledetails:
							page === 1
								? [
										{ publishedfileid: '3756492110' },
										{ publishedfileid: '3752353489' },
									]
								: [{ publishedfileid: '2798571210' }],
					},
				},
			}
		})
		const metadata = new SteamWebApiMetadata('key', '1440670', 'https://steam.test')

		const first = await metadata.listUserItemIds(76561198031919228n, 1, 2)
		const second = await metadata.listUserItemIds(76561198031919228n, first.nextPage, 2)

		expect(urls[0]?.pathname).toBe('/IPublishedFileService/GetUserFiles/v1/')
		expect(urls[0]?.searchParams.get('steamid')).toBe('76561198031919228')
		expect(urls[0]?.searchParams.get('appid')).toBe('1440670')
		expect(urls[0]?.searchParams.get('creator_appid')).toBe('1440670')
		expect(urls[0]?.searchParams.get('type')).toBe('myfiles')
		expect(urls[0]?.searchParams.get('admin_query')).toBe('true')
		expect(first).toEqual({
			workshopIds: [3756492110n, 3752353489n],
			nextPage: 2,
		})
		expect(second).toEqual({ workshopIds: [2798571210n], nextPage: undefined })
	})

	test('banned and missing items are unavailable', async () => {
		mockJsonFetch(() => ({
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
