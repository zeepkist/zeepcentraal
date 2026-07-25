import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageName = '@takumi-rs/core-linux-x64-gnu'
const nativeBinding = 'core.linux-x64-gnu.node'
const sourceDirectory = fileURLToPath(
	new URL(`../.output/server/node_modules/${packageName}`, import.meta.url),
)
const destinationDirectory = fileURLToPath(
	new URL(`../../../dist/node_modules/${packageName}`, import.meta.url),
)

if (!existsSync(join(sourceDirectory, nativeBinding))) {
	throw new Error(`Takumi native binding missing: ${join(sourceDirectory, nativeBinding)}`)
}

rmSync(destinationDirectory, { recursive: true, force: true })
mkdirSync(dirname(destinationDirectory), { recursive: true })
cpSync(sourceDirectory, destinationDirectory, { recursive: true })

console.log(`Staged ${packageName} in ${destinationDirectory}`)
