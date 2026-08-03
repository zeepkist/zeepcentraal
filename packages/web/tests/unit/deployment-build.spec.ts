import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootPackage = JSON.parse(
	readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'),
) as {
	scripts: Record<string, string>
	patchedDependencies?: Record<string, string>
}
const webPackage = JSON.parse(
	readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
	scripts: Record<string, string>
	devDependencies: Record<string, string>
}
const bunLock = readFileSync(new URL('../../../../bun.lock', import.meta.url), 'utf8')
const nuxtConfig = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
const buildAction = readFileSync(
	new URL('../../../../.github/actions/build-package-output/action.yml', import.meta.url),
	'utf8',
)
const buildDockerImageAction = readFileSync(
	new URL('../../../../.github/actions/build-docker-image/action.yml', import.meta.url),
	'utf8',
)
const setupBunDependenciesAction = readFileSync(
	new URL('../../../../.github/actions/setup-bun-deps/action.yml', import.meta.url),
	'utf8',
)
const prWorkflow = readFileSync(
	new URL('../../../../.github/workflows/pr-validate.yml', import.meta.url),
	'utf8',
)
const deployWorkflow = readFileSync(
	new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
	'utf8',
)
const webDockerfile = readFileSync(new URL('../../../../Dockerfile.web', import.meta.url), 'utf8')
const dockerIgnore = readFileSync(new URL('../../../../.dockerignore', import.meta.url), 'utf8')
const nativeDependencyDockerfiles = ['jobs', 'server'].map((name) =>
	readFileSync(new URL(`../../../../Dockerfile.${name}`, import.meta.url), 'utf8'),
)

describe('web deployment build', () => {
	it('builds the standard Nitro output', () => {
		expect(rootPackage.scripts['build:web']).toBe('bun --bun --cwd=packages/web run build')
		expect(webPackage.scripts.build).toBe('bun run prepare:nuxt && bun --bun nuxt build')
		expect(webPackage.scripts['prepare:nuxt']).toBe('bun --bun nuxt prepare')
		expect(webPackage.scripts.postinstall).toBe('bun run prepare:nuxt')
		expect(webPackage.scripts['build:deployment']).toBeUndefined()
		expect(webPackage.scripts['stage:takumi-addon']).toBeUndefined()
	})

	it('uses the Bun Nitro preset without standalone compilation', () => {
		expect(nuxtConfig).toContain("preset: 'bun'")
		expect(nuxtConfig).not.toContain("'nuxt-bun-compile'")
		expect(nuxtConfig).not.toContain('bunCompile:')
		expect(webPackage.devDependencies['nuxt-bun-compile']).toBeUndefined()
		expect(rootPackage.patchedDependencies?.['nuxt-bun-compile@0.1.32']).toBeUndefined()
		expect(bunLock).not.toContain('nuxt-bun-compile')
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

	it('keeps server-side Nuxt Content storage in memory', () => {
		expect(nuxtConfig).toMatch(
			/content:\s*\{\s*database:\s*\{\s*type:\s*'sqlite',\s*filename:\s*':memory:'/,
		)
	})

	it('uploads declared package outputs without web-native special cases', () => {
		expect(buildAction).toContain('name: Build Package Output')
		expect(buildAction).toContain('artifact-path:')
		expect(buildAction).toContain('include-hidden-files:')
		expect(buildAction).toContain(['name: package-output-', '$', '{{ inputs.name }}'].join(''))
		expect(buildAction).toContain(['path: ', '$', '{{ inputs.artifact-path }}'].join(''))
		expect(buildAction).not.toContain('compiled-binary')
		expect(buildAction).not.toContain('@takumi-rs/core-linux')

		for (const workflow of [prWorkflow, deployWorkflow]) {
			expect(workflow).toContain('uses: ./.github/actions/build-package-output')
			expect(workflow).toContain('artifact_path: packages/web/.output/')
			expect(workflow).toContain('include_hidden_files: true')
			expect(workflow).not.toContain('binary: zeepcentraal-web')
		}
	})

	it('downloads each package output to its declared runtime path', () => {
		expect(buildDockerImageAction).toContain('artifact-download-path:')
		expect(buildDockerImageAction).toContain('expected-path:')
		expect(buildDockerImageAction).toContain(
			['name: package-output-', '$', '{{ inputs.name }}'].join(''),
		)
		expect(buildDockerImageAction).toContain(
			['path: ', '$', '{{ inputs.artifact-download-path }}'].join(''),
		)
		expect(buildDockerImageAction).toContain('run: test -f "$EXPECTED_PATH"')
		expect(buildDockerImageAction).not.toContain('compiled-binary')
		expect(buildDockerImageAction).not.toContain('@takumi-rs/core-linux')

		for (const workflow of [prWorkflow, deployWorkflow]) {
			expect(workflow).toContain('artifact_download_path: packages/web/.output')
			expect(workflow).toContain('expected_path: packages/web/.output/server/index.mjs')
		}
	})

	it('exposes one required check for all package and Docker matrix builds', () => {
		const canMergeJob = prWorkflow.slice(prWorkflow.indexOf('\n  can-merge:\n'))

		expect(canMergeJob).toContain('name: can-merge')
		expect(canMergeJob).toContain('needs: [build-packages, docker-build]')
		expect(canMergeJob).toContain(['if: $', '{{ always() }}'].join(''))
		expect(canMergeJob).toContain(
			['BUILD_PACKAGES_RESULT: $', '{{ needs.build-packages.result }}'].join(''),
		)
		expect(canMergeJob).toContain(
			['DOCKER_BUILD_RESULT: $', '{{ needs.docker-build.result }}'].join(''),
		)
		expect(canMergeJob).toContain('test "$BUILD_PACKAGES_RESULT" = "success"')
		expect(canMergeJob).toContain('test "$DOCKER_BUILD_RESULT" = "success"')
	})

	it('validates non-develop branch pushes before pull request creation', () => {
		expect(prWorkflow).toMatch(/on:\s*\n\s+push:\s*\n\s+branches-ignore: \[develop\]/)
		expect(prWorkflow).toContain(
			[
				'group: pr-validate-$',
				'{{ github.event.pull_request.head.repo.full_name || github.repository }}-$',
				'{{ github.event.pull_request.head.ref || github.ref_name }}',
			].join(''),
		)
	})

	it('runs the complete Nitro output with pinned Bun as non-root', () => {
		expect(webDockerfile).toContain('FROM oven/bun:1.3.14-slim')
		expect(webDockerfile).toContain('COPY --chown=65532:65532 packages/web/.output .output')
		expect(webDockerfile).toContain('USER 65532:65532')
		expect(webDockerfile).toContain('ENTRYPOINT ["bun", "--bun", ".output/server/index.mjs"]')
		expect(webDockerfile).not.toContain('dist/zeepcentraal-web')
		expect(webDockerfile).not.toContain('@takumi-rs/core-linux')
		expect(dockerIgnore).toContain('!packages/web/.output/')
		expect(dockerIgnore).toContain('!packages/web/.output/**')
	})

	it('removes patch-only dependency plumbing', () => {
		for (const dockerfile of nativeDependencyDockerfiles) {
			expect(dockerfile).not.toContain('COPY patches/ patches/')
		}
		expect(setupBunDependenciesAction).not.toContain("'patches/**'")
	})

	it('restores source-aware Nuxt build data for web outputs only', () => {
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
			releaseJob.indexOf('Run semantic release'),
		)
	})
})
