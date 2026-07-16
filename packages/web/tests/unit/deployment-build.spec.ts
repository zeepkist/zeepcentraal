import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootPackage = JSON.parse(
	readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'),
) as {
	scripts: Record<string, string>
	patchedDependencies: Record<string, string>
}
const webPackage = JSON.parse(
	readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
	scripts: Record<string, string>
	devDependencies: Record<string, string>
}
const nuxtConfig = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
const buildAction = readFileSync(
	new URL('../../../../.github/actions/build-package-binary/action.yml', import.meta.url),
	'utf8',
)
const setupBunDependenciesAction = readFileSync(
	new URL('../../../../.github/actions/setup-bun-deps/action.yml', import.meta.url),
	'utf8',
)
const deployWorkflow = readFileSync(
	new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
	'utf8',
)
const webDockerfile = readFileSync(new URL('../../../../Dockerfile.web', import.meta.url), 'utf8')
const nativeDependencyDockerfiles = ['jobs', 'server'].map((name) =>
	readFileSync(new URL(`../../../../Dockerfile.${name}`, import.meta.url), 'utf8'),
)
const bunCompilePatch = readFileSync(
	new URL('../../../../patches/nuxt-bun-compile@0.1.32.patch', import.meta.url),
	'utf8',
)

describe('web deployment build', () => {
	it('routes root CI build through standalone deployment compilation', () => {
		expect(rootPackage.scripts['build:web']).toBe(
			'bun --bun --cwd=packages/web run build:deployment',
		)
		expect(webPackage.scripts['prepare:nuxt']).toBe('bun --bun nuxt prepare')
		expect(webPackage.scripts.postinstall).toBe('bun run prepare:nuxt')
		expect(webPackage.scripts.build.startsWith('bun run prepare:nuxt &&')).toBe(true)
		const prepareIndex = webPackage.scripts['build:deployment'].indexOf('bun run prepare:nuxt')
		const buildIndex = webPackage.scripts['build:deployment'].indexOf(
			'NUXT_BUN_COMPILE=true bun --bun nuxt build',
		)
		expect(prepareIndex).toBeGreaterThanOrEqual(0)
		expect(buildIndex).toBeGreaterThan(prepareIndex)
		expect(webPackage.scripts['build:deployment']).toContain('NUXT_BUN_COMPILE=true')
		expect(webPackage.scripts['build:deployment']).toContain('bun --bun nuxt build')
		expect(webPackage.scripts['build:deployment']).toContain(
			'test -x ../../dist/zeepcentraal-web',
		)
		expect(webPackage.scripts['build:deployment']).not.toContain('bun build --compile')
		expect(webPackage.scripts['build:deployment']).not.toContain('.output/server')
	})

	it('delegates standalone compilation to nuxt-bun-compile', () => {
		expect(webPackage.devDependencies['nuxt-bun-compile']).toBe('0.1.32')
		expect(nuxtConfig).toContain("'nuxt-bun-compile'")
		expect(nuxtConfig).toContain("enabled: process.env.NUXT_BUN_COMPILE === 'true'")
		expect(nuxtConfig).toContain("outfile: '../../dist/zeepcentraal-web'")
		expect(nuxtConfig).toContain("target: 'bun-linux-x64'")
		expect(nuxtConfig).toContain('autoCompile: true')
		expect(nuxtConfig).not.toContain("serveStatic: 'inline'")
		expect(nuxtConfig).not.toMatch(/externals:\s*\{\s*inline:/)
	})

	it('namespaces client assets for every CI build artifact', () => {
		const buildRevisionExpression = [
			'NUXT_BUILD_REVISION: $',
			'{{ github.sha }}-$',
			'{{ github.run_id }}-$',
			'{{ github.run_attempt }}',
		].join('')

		expect(nuxtConfig).toContain(
			'buildAssetsDir: getBuildAssetsDir(process.env.NUXT_BUILD_REVISION)',
		)
		expect(buildAction).toContain(buildRevisionExpression)
	})

	it('keeps server-side Nuxt Content storage outside Bun embedded paths', () => {
		expect(nuxtConfig).toMatch(
			/content:\s*\{\s*database:\s*\{\s*type:\s*'sqlite',\s*filename:\s*':memory:'/,
		)
	})

	it('keeps nuxt-bun-compile compatible with Nuxt Content prerendering', () => {
		expect(rootPackage.patchedDependencies['nuxt-bun-compile@0.1.32']).toBe(
			'patches/nuxt-bun-compile@0.1.32.patch',
		)
		expect(bunCompilePatch).toContain('-      nitroConfig.noExternals = true')
		expect(bunCompilePatch).toContain('-      nitroConfig.inlineDynamicImports = true')
		expect(bunCompilePatch).toContain('+      const allExternals = options.extraExternals')
		expect(bunCompilePatch).toContain('nitroConfig.externals.inline')
		expect(bunCompilePatch).toContain('"graphql"')
		expect(bunCompilePatch).toContain('args.push("--external", "chromium-bidi/*")')
		expect(bunCompilePatch).toContain('args.push("--conditions", "production")')
		expect(bunCompilePatch).toContain('["install", "--production", "--ignore-scripts"]')
		expect(bunCompilePatch).toContain('cwd: outputDirectory')
		expect(bunCompilePatch).toContain('resolve(nuxt.options.rootDir, options.outfile)')
		expect(bunCompilePatch).toContain(
			'nitro.options.static || nitro.options.preset === "nitro-prerender"',
		)
	})

	it('provides root Bun patches to every frozen Docker dependency install', () => {
		for (const dockerfile of nativeDependencyDockerfiles) {
			const copyPatches = dockerfile.indexOf('COPY patches/ patches/')
			const installDependencies = dockerfile.indexOf(
				'RUN HUSKY=0 bun install --frozen-lockfile',
			)

			expect(copyPatches).toBeGreaterThanOrEqual(0)
			expect(installDependencies).toBeGreaterThan(copyPatches)
		}
	})

	it('invalidates the dependency cache when Bun patches change', () => {
		expect(setupBunDependenciesAction).toContain("'patches/**'")
	})

	it('restores executable permissions after artifact download', () => {
		expect(webDockerfile).toContain(
			'COPY --chmod=755 --chown=nonroot:nonroot dist/zeepcentraal-web zeepcentraal-web',
		)
		expect(webDockerfile).toContain('ENTRYPOINT ["./zeepcentraal-web"]')
	})

	it('restores source-aware Nuxt build data for web binaries only', () => {
		expect(buildAction).toMatch(/if: \$\{\{ inputs\.name == 'web' \}\}/)
		expect(buildAction).toContain('uses: actions/cache@v6')
		expect(buildAction).toContain('packages/web/node_modules/.cache/nuxt')
		expect(buildAction).toContain('packages/web/node_modules/.cache/vite')
		expect(buildAction).not.toContain('packages/web/.nuxt/cache')
		expect(buildAction).toContain('packages/web/.data')
		expect(buildAction).toContain('packages/web/app/**')
		expect(buildAction).toContain('packages/web/config/**')
		expect(buildAction).toContain('packages/core/src/**')
		expect(buildAction).toContain('packages/database/src/**')
		expect(buildAction).toContain('restore-keys: |')
		expect(buildAction).not.toMatch(/^\s+packages\/web\/\.output$/m)
	})

	it('uses a supported Node runtime for semantic-release', () => {
		const releaseJob = deployWorkflow.slice(
			deployWorkflow.indexOf('\n  release:\n'),
			deployWorkflow.indexOf('\n  build-packages:\n'),
		)

		expect(releaseJob).toContain('uses: actions/setup-node@v7')
		expect(releaseJob).toContain("node-version: '26'")
		expect(releaseJob).toContain('package-manager-cache: false')
		expect(releaseJob.indexOf('Setup release Node')).toBeLessThan(
			releaseJob.indexOf('Run per-package semantic release'),
		)
	})
})
