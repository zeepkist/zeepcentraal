import { describe, expect, test } from 'bun:test'
import { BitReader, BitWriter } from './binary'
import {
	parseGameHostPacket,
	playerLeaderboardOverridesPacket,
	playerLeaderboardTimePacket,
	ZEEPKIST_PACKET_ID,
} from './gameServerPackets'

describe('V18 custom leaderboard wire framing', () => {
	test('numeric and override golden bytes include unaligned booleans and all five strings', () => {
		expect(Buffer.from(playerLeaderboardTimePacket(42n, 12.345)).toString('hex')).toBe(
			'd0ff2a000000000000003e0a8b8200000000000000000000',
		)
		expect(
			Buffer.from(
				playerLeaderboardOverridesPacket(42n, {
					time: '0:12.345',
					position: '2',
					name: 'X',
					points: '9 pts',
					pointsWon: ' ',
				}),
			).toString('hex'),
		).toBe('d0ff2a0000000000000000000000000000004480d189917199a1a9099009c02ac80181a39b0b0001')
		const reader = new BitReader(playerLeaderboardTimePacket(42n, 40000, true))
		expect(reader.readUInt16()).toBe(65488)
		expect(reader.readUInt64()).toBe(42n)
		expect(reader.readBoolean()).toBe(false)
		expect(reader.readFloat32()).toBe(36000)
		expect(reader.readInt32()).toBe(0)
		expect(reader.readBoolean()).toBe(true)
		expect(reader.readBoolean()).toBe(false)
		for (let i = 0; i < 5; i++) expect(reader.readString()).toBe('')
	})

	test('rejects invalid targets, nonfinite/negative times and oversized UTF8 overrides', () => {
		for (const time of [Number.NaN, Number.POSITIVE_INFINITY, -1])
			expect(() => playerLeaderboardTimePacket(42n, time)).toThrow()
		for (const id of [0n, -1n, 1n << 64n])
			expect(() => playerLeaderboardTimePacket(id, 1)).toThrow()
		expect(() =>
			playerLeaderboardOverridesPacket(42n, {
				time: '',
				position: '',
				name: 'ø'.repeat(2049),
				points: '',
				pointsWon: '',
			}),
		).toThrow()
	})

	test('parses complete leaderboard broadcast without retaining native names or blocked identities', () => {
		const writer = new BitWriter()
		writer.writeUInt16(ZEEPKIST_PACKET_ID.leaderboard)
		writer.writeByte(0)
		writer.writeInt32(1)
		writer.writeUInt64(42n)
		writer.writeString('Native name')
		writer.writeFloat32(12.345)
		writer.writeInt32(1)
		writer.writeUInt64(42n)
		for (const field of ['12.345', '17', 'Name', '400 pts', ' ']) writer.writeString(field)
		writer.writeInt32(1)
		writer.writeUInt64(99n)
		writer.writeBoolean(false)
		expect(parseGameHostPacket(writer.toUint8Array(), 1n)).toEqual({
			type: 'leaderboard',
			packetType: 0,
			times: [{ steamId: 42n, time: Math.fround(12.345) }],
			overrides: [
				{
					steamId: 42n,
					time: '12.345',
					position: '17',
					name: 'Name',
					points: '400 pts',
					pointsWon: ' ',
				},
			],
		})
		for (let i = 2; i < writer.toUint8Array().length; i++)
			expect(() => parseGameHostPacket(writer.toUint8Array().slice(0, i), 1n)).toThrow()
	})

	test('bounds leaderboard counts and reads absent-result fields too', () => {
		for (const count of [-1, 257]) {
			const writer = new BitWriter()
			writer.writeUInt16(ZEEPKIST_PACKET_ID.leaderboard)
			writer.writeByte(0)
			writer.writeInt32(count)
			expect(() => parseGameHostPacket(writer.toUint8Array(), 1n)).toThrow(
				'Invalid leaderboard count',
			)
		}
		const writer = new BitWriter()
		writer.writeUInt16(ZEEPKIST_PACKET_ID.playerUpdateResult)
		writer.writeUInt32(4)
		writer.writeBoolean(false)
		writer.writeString('level')
		writer.writeFloat32(0)
		writer.writeInt32(0)
		expect(parseGameHostPacket(writer.toUint8Array(), 1n)).toEqual({
			type: 'player-result',
			uid: 4,
			hasResult: false,
			levelUid: 'level',
			time: 0,
			checkpoints: 0,
		})
		expect(() => parseGameHostPacket(writer.toUint8Array().slice(0, -1), 1n)).toThrow()
	})
})
