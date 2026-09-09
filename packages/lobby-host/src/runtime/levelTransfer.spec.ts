import { expect, mock, test } from 'bun:test'
import { BitReader, ZEEPKIST_PACKET_ID } from '@zeepkist/core/zeepnet'
import type { PreparedLevel } from '../assets/preparedLevel'
import { LevelTransfer } from './levelTransfer'

function asset(uid: string) {
	const release = mock(() => {})
	const compressedData = new Uint8Array([1, 2, 3])
	const level: PreparedLevel = {
		contentSha256: uid,
		compressedData,
		lease: { data: compressedData, release },
		level: {
			uid,
			workshopId: 42n,
			name: uid,
			author: '',
			collaborators: '',
			overrideAuthorName: '',
		},
	}
	return { level, release }
}
function request(level: PreparedLevel) {
	return {
		type: 'level-request' as const,
		name: level.level.name,
		uid: level.level.uid,
		workshopId: level.level.workshopId,
	}
}

test('generic activation preserves playlist/skip/upload ordering and leases across replacement', async () => {
	const first = asset('one')
	const second = asset('two')
	let requested = first.level
	const ids: number[] = []
	const events: string[] = []
	const transfer = new LevelTransfer(
		async (bytes) => {
			const id = new BitReader(bytes).readUInt16()
			ids.push(id)
			if (id === ZEEPKIST_PACKET_ID.skipToLevel) transfer.request(request(requested))
		},
		900,
		(event) => events.push(event.type),
		() => {
			throw new Error('unexpected failure')
		},
	)
	try {
		await transfer.activate(first.level)
		expect(ids).toEqual([
			ZEEPKIST_PACKET_ID.changeLobbyPlaylist,
			ZEEPKIST_PACKET_ID.skipToLevel,
			ZEEPKIST_PACKET_ID.levelData,
		])
		expect(events).toEqual(['switch', 'request', 'uploaded', 'ready'])
		await transfer.activate(first.level)
		expect(ids).toHaveLength(3)
		requested = second.level
		await transfer.activate(second.level)
		transfer.request(request(first.level))
		await Bun.sleep(5)
		expect(ids.at(-1)).toBe(ZEEPKIST_PACKET_ID.levelData)
	} finally {
		transfer.close(second.level)
	}
	expect(first.release).toHaveBeenCalledTimes(1)
	expect(second.release).not.toHaveBeenCalled()
})
test('missing request times out and disconnect cancels pending activation', async () => {
	const { level, release } = asset('one')
	const transfer = new LevelTransfer(
		async () => {},
		900,
		() => {},
		() => {},
		5,
	)
	await expect(transfer.activate(level)).rejects.toThrow('Lobby level-data request timed out')
	transfer.close()
	expect(release).toHaveBeenCalledTimes(1)
	const next = new LevelTransfer(
		async () => {},
		900,
		() => {},
		() => {},
	)
	const activation = next.activate(asset('two').level)
	next.close()
	await expect(activation).rejects.toThrow('GameServer connection closed')
})
test('unknown level requests fail without publishing readiness', async () => {
	const failure = mock(() => {})
	const event = mock(() => {})
	const transfer = new LevelTransfer(async () => {}, 900, event, failure)
	transfer.request(request(asset('unknown').level))
	await Bun.sleep(5)
	expect(failure).toHaveBeenCalledTimes(1)
	expect(event).not.toHaveBeenCalled()
	transfer.close()
})
