const MAX_LEVEL_PAYLOAD_BYTES = 64 * 1024 * 1024
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function encodeZeepkistLevelPayload(content: string, v15: boolean) {
	const normalizedContent = content.startsWith('\uFEFF') ? content.slice(1) : content
	const lines = v15 ? normalizedContent.split('\n') : splitLegacyLines(normalizedContent)
	const sink = new Bun.ArrayBufferSink()
	sink.start({
		asUint8Array: true,
		highWaterMark: Math.min(normalizedContent.length + 4, 1024 * 1024),
	})
	const count = new DataView(new ArrayBuffer(4))
	count.setInt32(0, lines.length, true)
	sink.write(count)
	for (const line of lines) {
		const bytes = textEncoder.encode(line)
		sink.write(write7BitInt(bytes.length))
		sink.write(bytes)
	}
	const uncompressed = sink.end() as Uint8Array<ArrayBuffer>
	if (uncompressed.byteLength > MAX_LEVEL_PAYLOAD_BYTES) {
		throw new Error('Level payload is too large')
	}
	return Bun.gzipSync(uncompressed)
}

export function decodeZeepkistLevelPayload(payload: Uint8Array) {
	if (payload.byteLength > MAX_LEVEL_PAYLOAD_BYTES) throw new Error('Level payload is too large')
	const data = Bun.gunzipSync(payload as Uint8Array<ArrayBuffer>)
	if (data.byteLength > MAX_LEVEL_PAYLOAD_BYTES) throw new Error('Level payload is too large')
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
	let offset = 0
	if (data.length < 4) throw new Error('Level payload is truncated')
	const count = view.getInt32(offset, true)
	offset += 4
	if (count < 0 || count > 10_000_000) throw new Error('Invalid level line count')
	const lines: string[] = []
	for (let index = 0; index < count; index++) {
		const length = read7BitInt(
			data,
			() => offset,
			(next) => (offset = next),
		)
		if (length > data.length - offset) throw new Error('Level payload string is truncated')
		lines.push(textDecoder.decode(data.subarray(offset, offset + length)))
		offset += length
	}
	if (offset !== data.length) throw new Error('Level payload has trailing bytes')
	return lines
}

function splitLegacyLines(content: string) {
	const lines = content.split(/\r\n|\n|\r/)
	if (lines.at(-1) === '') lines.pop()
	return lines
}

function write7BitInt(value: number) {
	const bytes: number[] = []
	let remaining = value >>> 0
	do {
		let byte = remaining & 0x7f
		remaining >>>= 7
		if (remaining !== 0) byte |= 0x80
		bytes.push(byte)
	} while (remaining !== 0)
	return Uint8Array.from(bytes)
}

function read7BitInt(
	data: Uint8Array,
	getOffset: () => number,
	setOffset: (offset: number) => void,
) {
	let result = 0
	for (let shift = 0; shift < 35; shift += 7) {
		const offset = getOffset()
		const byte = data[offset]
		if (byte === undefined) throw new Error('Level payload string length is truncated')
		setOffset(offset + 1)
		result |= (byte & 0x7f) << shift
		if ((byte & 0x80) === 0) return result >>> 0
	}
	throw new Error('Level payload string length is invalid')
}
