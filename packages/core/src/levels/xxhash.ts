import { createRequire } from 'node:module'
import { join } from 'node:path'

interface XxHashAddon {
	XXHash128: {
		hash(content: Buffer): Buffer
	}
}

function loadXxHashAddon(): XxHashAddon {
	const require = createRequire(import.meta.url)
	const candidates = [
		'/app/node_modules/xxhash-addon/xxhash-addon.js',
		join(process.cwd(), 'node_modules', 'xxhash-addon', 'xxhash-addon.js'),
		'xxhash-addon',
	]
	const errors: unknown[] = []

	for (const candidate of candidates) {
		try {
			return require(candidate) as XxHashAddon
		} catch (error) {
			errors.push(error)
		}
	}

	throw new AggregateError(errors, 'Failed to load xxhash-addon')
}

const { XXHash128 } = loadXxHashAddon()

export function xxHash128Hex(content: string): string {
	return XXHash128.hash(Buffer.from(content, 'utf8')).toString('hex').toUpperCase()
}
