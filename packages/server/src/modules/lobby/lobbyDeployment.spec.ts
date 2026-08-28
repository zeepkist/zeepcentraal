import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const serverPackage = JSON.parse(
	readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> }
const serverBuildScript = readFileSync(
	new URL('../../../scripts/build.ts', import.meta.url),
	'utf8',
)
const serverDockerfile = readFileSync(
	new URL('../../../../../Dockerfile.server', import.meta.url),
	'utf8',
)

describe('lobby Steam runtime dependencies', () => {
	it('keeps file-backed and dynamic Steam dependencies outside the compiled binary', () => {
		expect(serverPackage.scripts.build).toBe('bun --no-env-file scripts/build.ts')
		expect(serverBuildScript).toContain("'@doctormckay/steam-crypto'")
		expect(serverBuildScript).toContain("'lzma'")
		expect(serverDockerfile).toContain(
			'cp -R "$(dirname "$steam_crypto_package")" /native-node_modules/@doctormckay/steam-crypto',
		)
		expect(serverDockerfile).toContain(
			'cp -R "$(dirname "$lzma_package")" /native-node_modules/lzma',
		)
		expect(serverDockerfile).toContain(
			'test -f /native-node_modules/@doctormckay/steam-crypto/system.pem',
		)
		expect(serverDockerfile).toContain('test -f /native-node_modules/lzma/src/lzma_worker.js')
	})
})
