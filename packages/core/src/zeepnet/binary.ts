const MAX_VAR_UINT_BYTES = 5

export class BitReader {
	private bitPosition = 0
	private readonly view: DataView
	private readonly scratch = new DataView(new ArrayBuffer(8))

	constructor(private readonly data: Uint8Array) {
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
	}

	get remainingBits() {
		return this.data.length * 8 - this.bitPosition
	}

	readBoolean() {
		return this.readBits(1) === 1
	}

	readByte() {
		return this.readBits(8)
	}

	readUInt16() {
		return this.readBits(16)
	}

	readInt32() {
		return this.readBits(32) | 0
	}

	readUInt32() {
		return this.readBits(32) >>> 0
	}

	readUInt64() {
		let value = 0n
		for (let bit = 0n; bit < 64n; bit++) {
			value |= BigInt(this.readBits(1)) << bit
		}
		return value
	}

	readInt64() {
		const value = this.readUInt64()
		return value >= 0x8000_0000_0000_0000n ? value - 0x1_0000_0000_0000_0000n : value
	}

	readFloat32() {
		if ((this.bitPosition & 7) === 0 && this.remainingBits >= 32) {
			const value = this.view.getFloat32(this.bitPosition >>> 3, true)
			this.bitPosition += 32
			return value
		}
		for (let index = 0; index < 4; index++) this.scratch.setUint8(index, this.readByte())
		return this.scratch.getFloat32(0, true)
	}

	readFloat64() {
		if ((this.bitPosition & 7) === 0 && this.remainingBits >= 64) {
			const value = this.view.getFloat64(this.bitPosition >>> 3, true)
			this.bitPosition += 64
			return value
		}
		for (let index = 0; index < 8; index++) this.scratch.setUint8(index, this.readByte())
		return this.scratch.getFloat64(0, true)
	}

	readVariableUInt32() {
		let value = 0
		for (let index = 0; index < MAX_VAR_UINT_BYTES; index++) {
			const byte = this.readByte()
			if (index === MAX_VAR_UINT_BYTES - 1 && (byte & 0xf0) !== 0) {
				throw new Error('Variable UInt32 exceeds 32 bits')
			}
			value |= (byte & 0x7f) << (index * 7)
			if ((byte & 0x80) === 0) {
				return value >>> 0
			}
		}
		throw new Error('Variable UInt32 exceeds five bytes')
	}

	readString(maxBytes = 4096) {
		const byteLength = this.readVariableUInt32()
		if (byteLength > maxBytes) {
			throw new Error(`String exceeds ${maxBytes} bytes`)
		}
		return new TextDecoder('utf-8', { fatal: true }).decode(this.readBytes(byteLength))
	}

	readBytes(length: number) {
		if (!Number.isSafeInteger(length) || length < 0 || length * 8 > this.remainingBits) {
			throw new Error('Packet ended before requested bytes')
		}
		if ((this.bitPosition & 7) === 0) {
			const offset = this.bitPosition >>> 3
			this.bitPosition += length * 8
			return this.data.subarray(offset, offset + length)
		}
		const result = new Uint8Array(length)
		for (let index = 0; index < length; index++) {
			result[index] = this.readByte()
		}
		return result
	}

	private readBits(count: number) {
		if (count < 1 || count > 32 || count > this.remainingBits) {
			throw new Error('Packet ended before requested bits')
		}
		let value = 0
		for (let bit = 0; bit < count; bit++) {
			const sourcePosition = this.bitPosition + bit
			const sourceByte = this.data[sourcePosition >>> 3]
			if (sourceByte === undefined) {
				throw new Error('Packet ended before requested bits')
			}
			value |= ((sourceByte >>> (sourcePosition & 7)) & 1) << bit
		}
		this.bitPosition += count
		return value >>> 0
	}
}

export class BitWriter {
	private bytes = new Uint8Array(256)
	private view = new DataView(this.bytes.buffer)
	private readonly scratch = new DataView(new ArrayBuffer(8))
	private bitPosition = 0

	writeBoolean(value: boolean) {
		this.writeBits(value ? 1 : 0, 1)
	}

	writeByte(value: number) {
		this.writeBits(value, 8)
	}

	writeUInt16(value: number) {
		this.writeBits(value, 16)
	}

	writeInt32(value: number) {
		this.writeBits(value >>> 0, 32)
	}

	writeUInt32(value: number) {
		this.writeBits(value >>> 0, 32)
	}

	writeUInt64(value: bigint) {
		for (let bit = 0n; bit < 64n; bit++) {
			this.writeBits(Number((value >> bit) & 1n), 1)
		}
	}

	writeInt64(value: bigint) {
		this.writeUInt64(BigInt.asUintN(64, value))
	}

	writeFloat32(value: number) {
		if ((this.bitPosition & 7) === 0) {
			this.ensureCapacity(32)
			this.view.setFloat32(this.bitPosition >>> 3, value, true)
			this.bitPosition += 32
			return
		}
		this.scratch.setFloat32(0, value, true)
		this.writeBytes(new Uint8Array(this.scratch.buffer, 0, 4))
	}

	writeFloat64(value: number) {
		if ((this.bitPosition & 7) === 0) {
			this.ensureCapacity(64)
			this.view.setFloat64(this.bitPosition >>> 3, value, true)
			this.bitPosition += 64
			return
		}
		this.scratch.setFloat64(0, value, true)
		this.writeBytes(new Uint8Array(this.scratch.buffer))
	}

	writeVariableUInt32(value: number) {
		let remaining = value >>> 0
		do {
			let byte = remaining & 0x7f
			remaining >>>= 7
			if (remaining !== 0) {
				byte |= 0x80
			}
			this.writeByte(byte)
		} while (remaining !== 0)
	}

	writeString(value: string) {
		const bytes = new TextEncoder().encode(value)
		this.writeVariableUInt32(bytes.length)
		this.writeBytes(bytes)
	}

	writeBytes(bytes: Uint8Array) {
		if ((this.bitPosition & 7) === 0) {
			this.ensureCapacity(bytes.byteLength * 8)
			this.bytes.set(bytes, this.bitPosition >>> 3)
			this.bitPosition += bytes.byteLength * 8
			return
		}
		for (const byte of bytes) {
			this.writeByte(byte)
		}
	}

	toUint8Array() {
		return this.bytes.subarray(0, Math.ceil(this.bitPosition / 8))
	}

	get bitLength() {
		return this.bitPosition
	}

	private writeBits(value: number, count: number) {
		this.ensureCapacity(count)
		for (let bit = 0; bit < count; bit++) {
			const targetPosition = this.bitPosition + bit
			const targetIndex = targetPosition >>> 3
			const current = this.bytes[targetIndex] ?? 0
			this.bytes[targetIndex] = current | (((value >>> bit) & 1) << (targetPosition & 7))
		}
		this.bitPosition += count
	}

	private ensureCapacity(additionalBits: number) {
		const requiredBytes = Math.ceil((this.bitPosition + additionalBits) / 8)
		if (requiredBytes <= this.bytes.byteLength) return
		let capacity = this.bytes.byteLength
		while (capacity < requiredBytes) capacity *= 2
		const next = new Uint8Array(capacity)
		next.set(this.bytes)
		this.bytes = next
		this.view = new DataView(next.buffer)
	}
}
