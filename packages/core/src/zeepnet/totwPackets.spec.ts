import { describe, expect, test } from 'bun:test'
import { BitReader, BitWriter } from './binary'
import {
	changeLobbyPlaylistPacket,
	createLobbyPacket,
	levelDataPacket,
	parseGameHostPacket,
	parseMasterRoomResponse,
	skipToLevelPacket,
	ZEEPKIST_PACKET_ID,
} from './totwPackets'

const LEVEL = {
	author: 'Author',
	collaborators: '',
	name: 'Track',
	overrideAuthorName: '',
	uid: 'uid',
	workshopId: 123n,
}

describe('Track of the Week packet codecs', () => {
	test('uses V18 stable packet IDs', () => {
		expect(ZEEPKIST_PACKET_ID).toEqual({
			createLobby: 18036,
			createLobbyResponse: 42517,
			joinLobby: 24070,
			joinLobbyResponse: 2983,
			initialState: 29635,
			changeLobbyMaster: 13890,
			changeLobbyPlaylist: 60338,
			changeLobbyPlaylistIndex: 18192,
			changeLobbyVisibility: 3826,
			levelData: 22792,
			skipToLevel: 63876,
		})
	})

	test('serializes room creation and looping one-track playlist', () => {
		const create = new BitReader(
			createLobbyPacket({
				isPublic: true,
				maxPlayers: 64,
				name: 'Room',
				originalHostName: 'Host',
			}),
		)
		expect(create.readUInt16()).toBe(ZEEPKIST_PACKET_ID.createLobby)
		expect(create.readInt32()).toBe(64)
		expect(create.readString()).toBe('Room')
		expect(create.readBoolean()).toBe(true)
		expect(create.readString()).toBe('Host')

		const playlist = new BitReader(changeLobbyPlaylistPacket(LEVEL, 900))
		expect(playlist.readUInt16()).toBe(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(playlist.readFloat64()).toBe(900)
		expect(playlist.readBoolean()).toBe(false)
		expect(playlist.readInt32()).toBe(0)
		expect(playlist.readInt32()).toBe(0)
		expect(playlist.readInt32()).toBe(1)
		expect(playlist.readString()).toBe('uid')
		expect(playlist.readUInt64()).toBe(123n)
		expect(playlist.readString()).toBe('Track')
		expect(playlist.readString()).toBe('')
		expect(playlist.readString()).toBe('')
		expect(playlist.readString()).toBe('Author')
		expect(playlist.readBoolean()).toBe(true)
		expect(playlist.readBoolean()).toBe(true)
		expect(playlist.readInt32()).toBe(1)

		const skip = new BitReader(skipToLevelPacket(LEVEL))
		expect(skip.readUInt16()).toBe(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(skip.readString()).toBe('uid')
		expect(skip.readUInt64()).toBe(123n)
	})

	test('serializes host level response as packet type 2', () => {
		const packet = new BitReader(levelDataPacket(LEVEL, Uint8Array.of(1, 2, 3)))
		expect(packet.readUInt16()).toBe(ZEEPKIST_PACKET_ID.levelData)
		expect(packet.readInt32()).toBe(2)
		expect(packet.readString()).toBe('Track')
		expect(packet.readString()).toBe('uid')
		expect(packet.readUInt64()).toBe(123n)
		expect(packet.readInt32()).toBe(3)
		expect([...packet.readBytes(3)]).toEqual([1, 2, 3])
	})

	test('parses master assignment responses', () => {
		const create = packet(ZEEPKIST_PACKET_ID.createLobbyResponse, (writer) => {
			writer.writeUInt16(1)
			writer.writeString('join-id')
		})
		expect(parseMasterRoomResponse(create)).toEqual({
			type: 'create',
			result: 1,
			joinId: 'join-id',
		})
		const join = packet(ZEEPKIST_PACKET_ID.joinLobbyResponse, (writer) => {
			writer.writeUInt16(1)
			writer.writeString('127.0.0.1')
			writer.writeInt32(12345)
		})
		expect(parseMasterRoomResponse(join)).toEqual({
			type: 'join',
			result: 1,
			host: '127.0.0.1',
			port: 12345,
		})
	})

	test('detects local host and level-data requests', () => {
		const initial = packet(ZEEPKIST_PACKET_ID.initialState, (writer) => {
			writer.writeInt32(1)
			writer.writeUInt32(7)
			writer.writeUInt64(76561198000000000n)
			writer.writeString('tag')
			writer.writeString('name')
			writer.writeBoolean(true)
			writer.writeString('{}')
			for (let index = 0; index < 10; index++) writer.writeFloat32(0)
			writer.writeBoolean(false)
			writer.writeBoolean(false)
			writer.writeByte(0)
			for (let index = 0; index < 13; index++) writer.writeBoolean(false)
			writer.writeInt32(0)
			writer.writeInt32(0)
			writer.writeBoolean(false)
		})
		expect(parseGameHostPacket(initial, 76561198000000000n)).toEqual({
			type: 'initial',
			isHost: true,
		})

		const request = packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
			writer.writeInt32(3)
			writer.writeString('')
			writer.writeString('uid')
			writer.writeUInt64(123n)
			writer.writeInt32(0)
		})
		expect(parseGameHostPacket(request, 0n)).toEqual({
			type: 'level-request',
			uid: 'uid',
			workshopId: 123n,
		})
	})

	test('bounds malformed level request data', () => {
		const request = packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
			writer.writeInt32(3)
			writer.writeString('')
			writer.writeString('uid')
			writer.writeUInt64(123n)
			writer.writeInt32(64 * 1024 * 1024 + 1)
		})
		expect(() => parseGameHostPacket(request, 0n)).toThrow('Invalid level payload')
	})
})

function packet(id: number, write: (writer: BitWriter) => void) {
	const writer = new BitWriter()
	writer.writeUInt16(id)
	write(writer)
	return writer.toUint8Array()
}
