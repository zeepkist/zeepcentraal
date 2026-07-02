import { createRequire } from 'node:module'

interface XxHashAddon {
	XXHash128: {
		hash(content: Buffer): Buffer
	}
}

const require = createRequire(import.meta.url)

const { XXHash128 } = require('xxhash-addon') as XxHashAddon

export function xxHash128Hex(content: string): string {
	return XXHash128.hash(Buffer.from(content, 'utf8')).toString('hex').toUpperCase()
}
