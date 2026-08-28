import { describe, expect, test } from 'bun:test'
import { BitReader, BitWriter } from './binary'
import {
	changeLobbyPlaylistPacket,
	createLobbyPacket,
	levelDataPacket,
	levelDataRequestPacket,
	levelLoadedPacket,
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
			changeLobbyGameProperties: 44133,
			changeLobbyMaster: 13890,
			changeLobbyPlaylist: 60338,
			changeLobbyPlaylistIndex: 18192,
			changeLobbyVisibility: 3826,
			levelData: 22792,
			levelLoaded: 29603,
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
		expect(playlist.readBoolean()).toBe(false)
		expect(playlist.readBoolean()).toBe(true)
		expect(playlist.readInt32()).toBe(1)

		const skip = new BitReader(skipToLevelPacket(LEVEL))
		expect(skip.readUInt16()).toBe(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(skip.readString()).toBe('uid')
		expect(skip.readUInt64()).toBe(123n)
	})

	test('matches captured V18 host-transition packet bytes', () => {
		const capturedLevel = {
			author: 'maxie12',
			collaborators: '',
			name: 'ZSL - Cube Maintenance',
			overrideAuthorName: '',
			uid: 'Six Cubed-maxie12-01KDKQ3K2KA14WK8RP9AD61TVQ',
			workshopId: 3633729201n,
		}
		expect(changeLobbyPlaylistPacket(capturedLevel, 720).toBase64()).toBe(
			'susAAAAAAICGQAAAAAAAAAAAAgAAAFim0vBAhurEysha2sLw0spiZFpgYpaIlqJmlmSWgmJorpZwpKBygohsYqisomKdLLEBAAAALLSmmEBaQIbqxMpAmsLS3OjK3MLcxsoAAA7awvDSymJkDAAAAAA=',
		)
		expect(skipToLevelPacket(capturedLevel).toBase64()).toBe(
			'hPksU2l4IEN1YmVkLW1heGllMTItMDFLREtRM0syS0ExNFdLOFJQOUFENjFUVlGxTpbYAAAAAA==',
		)
		expect(levelLoadedPacket().toBase64()).toBe('o3M=')
		const request = levelDataRequestPacket()
		expect(request).toHaveLength(20)
		expect(new Bun.CryptoHasher('sha256').update(request).digest('hex')).toBe(
			'f0aad2c1e4401575ab7f47129eabab5d67914c88b21fd123f11bc9c8fad19997',
		)
	})

	test('serializes host level response as packet type 2', () => {
		const request = { name: 'Requested Name', uid: 'request-uid', workshopId: 999n }
		const bytes = levelDataPacket(request, Uint8Array.of(1, 2, 3))
		expect(bytes.toBase64()).toBe(
			'CFkCAAAADlJlcXVlc3RlZCBOYW1lC3JlcXVlc3QtdWlk5wMAAAAAAAADAAAAAQID',
		)
		const packet = new BitReader(bytes)
		expect(packet.readUInt16()).toBe(ZEEPKIST_PACKET_ID.levelData)
		expect(packet.readInt32()).toBe(2)
		expect(packet.readString()).toBe('Requested Name')
		expect(packet.readString()).toBe('request-uid')
		expect(packet.readUInt64()).toBe(999n)
		expect(packet.readInt32()).toBe(3)
		expect([...packet.readBytes(3)]).toEqual([1, 2, 3])

		const loaded = new BitReader(levelLoadedPacket())
		expect(loaded.readUInt16()).toBe(ZEEPKIST_PACKET_ID.levelLoaded)
		expect(loaded.remainingBits).toBe(0)
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

	test('detects local host, level-data requests, and game properties', () => {
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
			name: '',
			uid: 'uid',
			workshopId: 123n,
		})

		const gameProperties = packet(ZEEPKIST_PACKET_ID.changeLobbyGameProperties, (writer) => {
			writer.writeFloat64(900)
			writer.writeFloat64(123.5)
			writer.writeString('uid')
			writer.writeUInt64(123n)
		})
		expect(parseGameHostPacket(gameProperties, 0n)).toEqual({
			type: 'game-properties',
			levelLoadedAt: 123.5,
			roundTime: 900,
			uid: 'uid',
			workshopId: 123n,
		})
	})

	test('parses playlist broadcasts and returned level data', () => {
		const playlist = packet(ZEEPKIST_PACKET_ID.changeLobbyPlaylist, (writer) => {
			writer.writeFloat64(900)
			writer.writeBoolean(false)
			writer.writeInt32(0)
			writer.writeInt32(0)
			writer.writeInt32(1)
			writer.writeString('uid')
			writer.writeUInt64(123n)
			writer.writeString('Track')
			writer.writeString('Collaborator')
			writer.writeString('Override')
			writer.writeString('Author')
			writer.writeBoolean(true)
			writer.writeBoolean(true)
			writer.writeInt32(1)
		})
		expect(parseGameHostPacket(playlist, 0n)).toEqual({
			type: 'playlist',
			currentIndex: 0,
			isRandom: false,
			levels: [
				{
					author: 'Author',
					collaborators: 'Collaborator',
					name: 'Track',
					overrideAuthorName: 'Override',
					played: true,
					uid: 'uid',
					workshopId: 123n,
				},
			],
			nextIndex: 0,
			originalPlaylistLength: 1,
			roundTime: 900,
			wasSynced: true,
		})

		const levelData = packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
			writer.writeInt32(1)
			writer.writeString('Track')
			writer.writeString('')
			writer.writeUInt64(0n)
			writer.writeInt32(3)
			writer.writeBytes(Uint8Array.of(1, 2, 3))
		})
		expect(parseGameHostPacket(levelData, 0n)).toEqual({
			type: 'level-data',
			data: Uint8Array.of(1, 2, 3),
			name: 'Track',
			uid: '',
			workshopId: 0n,
		})
	})

	test('bounds malformed level request data', () => {
		const oversized = packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
			writer.writeInt32(3)
			writer.writeString('')
			writer.writeString('uid')
			writer.writeUInt64(123n)
			writer.writeInt32(64 * 1024 * 1024 + 1)
		})
		expect(() => parseGameHostPacket(oversized, 0n)).toThrow('Invalid level payload')

		const truncated = packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
			writer.writeInt32(1)
			writer.writeString('Track')
			writer.writeString('uid')
			writer.writeUInt64(123n)
			writer.writeInt32(3)
			writer.writeByte(1)
		})
		expect(() => parseGameHostPacket(truncated, 0n)).toThrow('Invalid level payload')
	})

	test('bounds malformed game properties', () => {
		const properties = packet(ZEEPKIST_PACKET_ID.changeLobbyGameProperties, (writer) => {
			writer.writeFloat64(900)
			writer.writeFloat64(123.5)
			writer.writeString('x'.repeat(4097))
			writer.writeUInt64(123n)
		})
		expect(() => parseGameHostPacket(properties, 0n)).toThrow('String exceeds 4096 bytes')
	})

	test('bounds malformed playlists', () => {
		const oversized = packet(ZEEPKIST_PACKET_ID.changeLobbyPlaylist, (writer) => {
			writer.writeFloat64(900)
			writer.writeBoolean(false)
			writer.writeInt32(0)
			writer.writeInt32(0)
			writer.writeInt32(1002)
		})
		expect(() => parseGameHostPacket(oversized, 0n)).toThrow('Invalid playlist length')

		const truncated = packet(ZEEPKIST_PACKET_ID.changeLobbyPlaylist, (writer) => {
			writer.writeFloat64(900)
			writer.writeBoolean(false)
			writer.writeInt32(0)
			writer.writeInt32(0)
			writer.writeInt32(1)
		})
		expect(() => parseGameHostPacket(truncated, 0n)).toThrow(
			'Packet ended before requested bits',
		)
	})
})

function packet(id: number, write: (writer: BitWriter) => void) {
	const writer = new BitWriter()
	writer.writeUInt16(id)
	write(writer)
	return writer.toUint8Array()
}
