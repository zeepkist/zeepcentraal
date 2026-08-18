import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const serverPackage = JSON.parse(
	readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> }
const serverDockerfile = readFileSync(
	new URL('../../../../../Dockerfile.server', import.meta.url),
	'utf8',
)

describe('lobby Steam runtime dependencies', () => {
	it('keeps steam-crypto and its public key outside the compiled binary', () => {
		expect(serverPackage.scripts.build).toContain('--external @doctormckay/steam-crypto')
		expect(serverDockerfile).toContain(
			'cp -R "$(dirname "$steam_crypto_package")" /native-node_modules/@doctormckay/steam-crypto',
		)
		expect(serverDockerfile).toContain(
			'test -f /native-node_modules/@doctormckay/steam-crypto/system.pem',
		)
	})
})
