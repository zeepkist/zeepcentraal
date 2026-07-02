import { createRequire } from 'node:module'
import { join } from 'node:path'

interface XxHashAddon {
	XXHash128: {
		hash(content: Buffer): Buffer
	}
}

function loadXxHashAddon(): XxHashAddon {
	try {
		return createRequire(join(process.cwd(), 'package.json'))('xxhash-addon') as XxHashAddon
	} catch {
		return createRequire(import.meta.url)('xxhash-addon') as XxHashAddon
	}
}

const { XXHash128 } = loadXxHashAddon()

export function xxHash128Hex(content: string): string {
	return XXHash128.hash(Buffer.from(content, 'utf8')).toString('hex').toUpperCase()
}
