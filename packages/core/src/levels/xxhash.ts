import { XXHash128 } from 'xxhash-addon'

export function xxHash128Hex(content: string): string {
	return XXHash128.hash(Buffer.from(content, 'utf8')).toString('hex').toUpperCase()
}
