import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const coreRequire = createRequire(join(process.cwd(), 'packages', 'core', 'package.json'))
const target = process.argv[2]
if (!target) {
	throw new Error('Missing native dependency output name')
}

const output = join(process.cwd(), 'dist', target)

rmSync(output, { force: true, recursive: true })
mkdirSync(output, { recursive: true })

const xxhashPackage = coreRequire.resolve('xxhash-addon/package.json')
const xxhashRequire = createRequire(xxhashPackage)
const packages = [
	{ name: 'xxhash-addon', packageJson: xxhashPackage },
	{ name: 'node-gyp-build', packageJson: xxhashRequire.resolve('node-gyp-build/package.json') },
]

for (const { name, packageJson } of packages) {
	const packageDirectory = dirname(packageJson)
	cpSync(packageDirectory, join(output, name), { recursive: true })
}
