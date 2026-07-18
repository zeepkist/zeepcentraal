export class BinaryReader {
	private offset = 0
	private readonly view: DataView

	constructor(private readonly buffer: Uint8Array) {
		this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
	}

	readInt32(): number {
		const value = this.view.getInt32(this.offset, true)
		this.offset += 4
		return value
	}

	readUInt64(): bigint {
		const value = this.view.getBigUint64(this.offset, true)
		this.offset += 8
		return value
	}

	readFloat(): number {
		const value = this.view.getFloat32(this.offset, true)
		this.offset += 4
		return value
	}

	readInt16(): number {
		const value = this.view.getInt16(this.offset, true)
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
