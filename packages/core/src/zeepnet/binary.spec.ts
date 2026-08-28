import { expect, test } from 'bun:test'
import { BitReader, BitWriter } from './binary'

test('round-trips aligned and unaligned numeric extremes', () => {
	const writer = new BitWriter()
	writer.writeBoolean(true)
	writer.writeUInt16(0xffff)
	writer.writeInt32(-2_147_483_648)
	writer.writeUInt32(0xffff_ffff)
	writer.writeInt64(-0x8000_0000_0000_0000n)
	writer.writeUInt64(0xffff_ffff_ffff_ffffn)
	writer.writeFloat32(123.5)
	writer.writeFloat64(-Number.MAX_VALUE)

	const reader = new BitReader(writer.toUint8Array())
	expect(reader.readBoolean()).toBe(true)
	expect(reader.readUInt16()).toBe(0xffff)
	expect(reader.readInt32()).toBe(-2_147_483_648)
	expect(reader.readUInt32()).toBe(0xffff_ffff)
	expect(reader.readInt64()).toBe(-0x8000_0000_0000_0000n)
	expect(reader.readUInt64()).toBe(0xffff_ffff_ffff_ffffn)
	expect(reader.readFloat32()).toBe(123.5)
	expect(reader.readFloat64()).toBe(-Number.MAX_VALUE)
})

test('grows storage and returns aligned byte views without copying', () => {
	const source = Uint8Array.from({ length: 4_096 }, (_, index) => index & 0xff)
	const writer = new BitWriter()
	writer.writeBytes(source)
	const encoded = writer.toUint8Array()
	expect(encoded).toEqual(source)

	const reader = new BitReader(encoded)
	const decoded = reader.readBytes(encoded.length)
	expect(decoded.buffer).toBe(encoded.buffer)
	expect(decoded).toEqual(source)
})

test('rejects malformed variable integers and byte lengths', () => {
	expect(() =>
		new BitReader(Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x10)).readVariableUInt32(),
	).toThrow('Variable UInt32 exceeds 32 bits')
	expect(() => new BitReader(Uint8Array.of(1)).readBytes(2)).toThrow(
		'Packet ended before requested bytes',
	)
})
