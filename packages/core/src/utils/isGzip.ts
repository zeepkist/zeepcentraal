export function isGzip(buffer: Buffer): boolean {
	return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
}
