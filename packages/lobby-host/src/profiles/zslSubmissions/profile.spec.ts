import { beforeEach, expect, mock, test } from 'bun:test'
import { LevelPayloadCache } from '../../assets/levelPayloadCache'
import type { PreparedLevel, PreparedPlaylist } from '../../assets/preparedLevel'
import type { RoomContext } from '../contracts'

let empty = false
const download = mock(async () => new Uint8Array([1, 2, 3]))
mock.module('@zeepkist/database/services/level-submissions', () => ({
	downloadSubmissionPayload: download,
	getSubmissionPlaylist: async () => ({
		playlist: { digest: 'snapshot' },
		members: empty
			? []
			: [1n, 2n].map((workshopId) => ({
					workshopId,
					validation: {
						payload: {
							uid: String(workshopId),
							sha256: String(workshopId),
							name: 'Track',
							author: '',
							collaborators: '',
							overrideAuthorName: '',
							objectKey: 'inspector/fake',
							byteSize: 3,
						},
					},
				})),
	}),
}))
const { ZslSubmissionsProfile } = await import('./profile')
beforeEach(() => {
	empty = false
	download.mockClear()
})
test('prepares only first payload and releases all leases on stop', async () => {
	const cache = new LevelPayloadCache()
	const profile = new ZslSubmissionsProfile('1', cache, { info() {}, warn() {} }, 300)
	await profile.prepare()
	expect(download).toHaveBeenCalledTimes(1)
	expect(cache.size).toBe(1)
	profile.stop()
	expect(cache.size).toBe(0)
})
test('empty playlist never prepares a fallback level', async () => {
	empty = true
	const profile = new ZslSubmissionsProfile(
		'1',
		new LevelPayloadCache(),
		{ info() {}, warn() {} },
		300,
	)
	expect(await profile.prepare()).toBeUndefined()
	expect(download).not.toHaveBeenCalled()
	profile.stop()
})
test('sequential next-index response has no skip and a stopped session ignores callbacks', async () => {
	const cache = new LevelPayloadCache()
	const profile = new ZslSubmissionsProfile('1', cache, { info() {}, warn() {} }, 300)
	await profile.prepare()
	let received: PreparedPlaylist | undefined
	const update = mock(async (_playlist: PreparedPlaylist, _current: number, _next: number) => {})
	const context = {
		signal: new AbortController().signal,
		isHost: () => true,
		isReady: () => true,
		activatePlaylist: async (_level: PreparedLevel, playlist: PreparedPlaylist) => {
			received = playlist
		},
		updatePlaylist: update,
		disconnect: async () => {},
		chat: { command: async () => {} },
	} as unknown as RoomContext
	const session = profile.createSession(context)
	await session.start()
	await received?.load('2', 2n)
	expect(download).toHaveBeenCalledTimes(2)
	session.onPacket({ type: 'playlist-index', currentIndex: 1, nextIndex: 0, selectNext: false })
	session.onPacket({ type: 'playlist-index', currentIndex: 1, nextIndex: 0, selectNext: true })
	await Bun.sleep(0)
	expect(update.mock.calls[0]?.slice(1)).toEqual([1, 0])
	session.stop()
	session.onPacket({ type: 'playlist-index', currentIndex: 0, nextIndex: 1, selectNext: true })
	expect(update).toHaveBeenCalledTimes(1)
	profile.stop()
	expect(cache.size).toBe(0)
})
