import { expect, test } from 'bun:test'
import {
	changeLobbyLevelsPacket,
	changeLobbyPlaylistPacket,
	parseGameHostPacket,
} from './gameServerPackets'

const level = (uid: string) => ({
	uid,
	workshopId: 1n,
	name: uid,
	author: '',
	collaborators: '',
	overrideAuthorName: '',
})
test('single-track golden compatibility and sequential multi-track framing', () => {
	const levels = [level('one'), level('two')]
	expect(changeLobbyLevelsPacket([levels[0]!], 300, 0, 0)).toEqual(
		changeLobbyPlaylistPacket(levels[0]!, 300),
	)
	const packet = parseGameHostPacket(changeLobbyLevelsPacket(levels, 300, 1, 0), 0n, 0)
	expect(packet).toMatchObject({ type: 'playlist', currentIndex: 1, nextIndex: 0 })
	for (const [current, next] of [
		[-1, 0],
		[0, 2],
		[0.5, 0],
	])
		expect(() => changeLobbyLevelsPacket(levels, 300, current!, next!)).toThrow()
	expect(() => changeLobbyLevelsPacket([], 300, 0, 0)).toThrow()
})
