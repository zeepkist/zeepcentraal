import { describe, expect, test } from 'bun:test'
import { BitReader, BitWriter } from './binary'
import { LOBBY_PACKET_ID, parseLobbyPacket } from './lobbyPackets'

describe('Lidgren bit encoding', () => {
	test('round trips values across unaligned boolean boundaries', () => {
		const writer = new BitWriter()
		writer.writeBoolean(true)
		writer.writeString('Zeepkist')
		writer.writeUInt64(76_561_198_000_000_001n)

		const reader = new BitReader(writer.toUint8Array())
		expect(reader.readBoolean()).toBe(true)
		expect(reader.readString()).toBe('Zeepkist')
		expect(reader.readUInt64()).toBe(76_561_198_000_000_001n)
	})

	test('rejects variable integers wider than UInt32', () => {
		const reader = new BitReader(Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x10))

		expect(() => reader.readVariableUInt32()).toThrow('Variable UInt32 exceeds 32 bits')
	})
})

describe('lobby packets', () => {
	test('parses full lists with bit-packed public flags', () => {
		const writer = new BitWriter()
		writer.writeUInt16(LOBBY_PACKET_ID.list)
		writer.writeInt32(2)
		writeLobby(writer, 'one', 'Public room', 'Alice', 1n, 8, 64, true)
		writeLobby(writer, 'two', 'Private room', 'Bob', 2n, 3, 16, false)

		expect(parseLobbyPacket(writer.toUint8Array())).toEqual({
			type: 'list',
			lobbies: [
				{
					id: 'one',
					title: 'Public room',
					isPublic: true,
					host: { name: 'Alice', steamId: '1' },
					players: 8,
					playerLimit: 64,
				},
				{
					id: 'two',
					title: 'Private room',
					isPublic: false,
					host: { name: 'Bob', steamId: '2' },
					players: 3,
					playerLimit: 16,
				},
			],
		})
	})
})

function writeLobby(
	writer: BitWriter,
	id: string,
	title: string,
	host: string,
	steamId: bigint,
	players: number,
	playerLimit: number,
	isPublic: boolean,
) {
	writer.writeString(id)
	writer.writeString(title)
	writer.writeString(host)
	writer.writeUInt64(steamId)
	writer.writeInt32(players)
	writer.writeInt32(playerLimit)
	writer.writeBoolean(isPublic)
}
