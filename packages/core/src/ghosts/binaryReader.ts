export class BinaryReader {
	private offset = 0

	constructor(private readonly buffer: Buffer) {}

	readInt32(): number {
		const value = this.buffer.readInt32LE(this.offset)
		this.offset += 4
		return value
	}

	readUInt64(): bigint {
		const value = this.buffer.readBigUInt64LE(this.offset)
		this.offset += 8
		return value
	}

	readFloat(): number {
		const value = this.buffer.readFloatLE(this.offset)
		this.offset += 4
		return value
	}

	readInt16(): number {
		const value = this.buffer.readInt16LE(this.offset)
		this.offset += 2
		return value
	}

	readByte(): number {
		return this.buffer[this.offset++] ?? 0
	}

	readBoolean(): boolean {
		return this.readByte() !== 0
	}
}
