import { gunzipSync, gzipSync } from 'node:zlib'

export function encodeZeepkistLevelPayload(content: string, v15: boolean) {
	const normalizedContent = content.startsWith('\uFEFF') ? content.slice(1) : content
	const lines = v15 ? normalizedContent.split('\n') : splitLegacyLines(normalizedContent)
	const chunks: Buffer[] = []
	const count = Buffer.allocUnsafe(4)
	count.writeInt32LE(lines.length)
	chunks.push(count)
	for (const line of lines) {
		const bytes = Buffer.from(line, 'utf8')
		chunks.push(write7BitInt(bytes.length), bytes)
	}
	return gzipSync(Buffer.concat(chunks))
}

export function decodeZeepkistLevelPayload(payload: Uint8Array) {
	const data = gunzipSync(payload)
	let offset = 0
	if (data.length < 4) throw new Error('Level payload is truncated')
	const count = data.readInt32LE(offset)
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
		lines.push(data.subarray(offset, offset + length).toString('utf8'))
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
	return Buffer.from(bytes)
}

function read7BitInt(data: Buffer, getOffset: () => number, setOffset: (offset: number) => void) {
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
