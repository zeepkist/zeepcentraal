import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// SteamCMD images run Ubuntu 22.04; this is the oldest glibc among Rust runtimes.
const MAX_GLIBC = [2, 35]

function highestRequiredGlibc(versionInfo) {
	let highest = null
	for (const match of versionInfo.matchAll(/\bGLIBC_(\d+)\.(\d+)\b/g)) {
		const version = [Number(match[1]), Number(match[2])]
		if (
			!highest ||
			version[0] > highest[0] ||
			(version[0] === highest[0] && version[1] > highest[1])
		) {
			highest = version
		}
	}
	return highest
}

function checkVersionInfo(versionInfo, binary) {
	const required = highestRequiredGlibc(versionInfo)
	if (
		required &&
		(required[0] > MAX_GLIBC[0] || (required[0] === MAX_GLIBC[0] && required[1] > MAX_GLIBC[1]))
	) {
		throw new Error(
			`${binary} requires GLIBC_${required.join('.')}; oldest runtime provides GLIBC_${MAX_GLIBC.join('.')}`,
		)
	}
	return required ? `GLIBC_${required.join('.')}` : 'no dynamic glibc requirement'
}

function main(binaries) {
	if (!binaries.length)
		throw new Error('Usage: node scripts/release/check-rust-abi.mjs BINARY...')
	for (const binary of binaries) {
		const versionInfo = execFileSync('readelf', ['--wide', '--version-info', binary], {
			encoding: 'utf8',
		})
		process.stdout.write(`${binary}: ${checkVersionInfo(versionInfo, binary)}\n`)
	}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	main(process.argv.slice(2))
}

export { checkVersionInfo, highestRequiredGlibc }
