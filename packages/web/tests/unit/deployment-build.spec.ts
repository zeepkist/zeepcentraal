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

	it('uploads declared package outputs without web-native special cases', () => {
		expect(buildAction).toContain('name: Build Package Output')
		expect(buildAction).toContain('artifact-path:')
		expect(buildAction).toContain('include-hidden-files:')
		expect(buildAction).toContain('upload-artifact:')
		expect(buildAction).toMatch(/if: \$\{\{ inputs\.upload-artifact == 'true' \}\}/)
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

		expect(prWorkflow).toContain('upload-artifact: false')
		expect(deployWorkflow).not.toContain('upload-artifact: false')
	})

	it('downloads each package output to its declared runtime path', () => {
		expect(buildDockerImageAction).toContain('artifact-download-path:')
		expect(buildDockerImageAction).toContain('expected-path:')
		expect(buildDockerImageAction).toContain('download-artifact:')
		expect(buildDockerImageAction).toMatch(
			/if: \$\{\{ inputs\.download-artifact == 'true' \}\}/,
		)
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

		expect(prWorkflow).toContain('download-artifact: false')
		expect(deployWorkflow).not.toContain('download-artifact: false')
	})

	it('preserves required quality and can-merge checks', () => {
		const canMergeJob = prWorkflow.slice(prWorkflow.indexOf('\n  can-merge:\n'))

		expect(canMergeJob).toContain('name: can-merge')
		expect(canMergeJob).toContain('needs: [quality, build-images]')
		expect(canMergeJob).toContain(['if: $', '{{ always() }}'].join(''))
		expect(canMergeJob).toContain(['QUALITY_RESULT: $', '{{ needs.quality.result }}'].join(''))
		expect(canMergeJob).toContain(
			['BUILD_IMAGES_RESULT: $', '{{ needs.build-images.result }}'].join(''),
		)
		expect(canMergeJob).toContain('test "$QUALITY_RESULT" = "success"')
		expect(canMergeJob).toContain('test "$BUILD_IMAGES_RESULT" = "success"')
	})

	it('routes pull request validation and deploy pushes without duplicate branch runs', () => {
		const prTriggers = prWorkflow.slice(
			prWorkflow.indexOf('\non:\n'),
			prWorkflow.indexOf('\npermissions:\n'),
		)
		const deployTriggers = deployWorkflow.slice(
			deployWorkflow.indexOf('\non:\n'),
			deployWorkflow.indexOf('\npermissions:\n'),
		)

		expect(prTriggers).toContain('pull_request:')
		expect(prTriggers).toContain('types: [opened, synchronize, reopened, ready_for_review]')
		expect(prTriggers).toContain('merge_group:')
		expect(prTriggers).toContain('branches: [develop]')
		expect(prTriggers).not.toContain('push:')

		expect(deployTriggers).toMatch(/push:\s*\n\s+branches: \[develop\]/)
		expect(deployTriggers).not.toContain('workflow_dispatch:')
		expect(deployTriggers).not.toContain('pull_request:')
		expect(deployTriggers).not.toContain('merge_group:')
	})

	it('cancels stale pull request runs and queues every deploy push', () => {
		expect(prWorkflow).toContain(
			['group: pr-validate-$', '{{ github.event.pull_request.number || github.ref }}'].join(
				'',
			),
		)
		expect(prWorkflow).toContain('cancel-in-progress: true')
		expect(deployWorkflow).toContain('group: deploy-develop')
		expect(deployWorkflow).toContain('cancel-in-progress: false')
		expect(deployWorkflow).toContain('queue: max')
	})

	it('runs pull request quality and package-image builds in parallel', () => {
		const buildImagesJob = prWorkflow.slice(
			prWorkflow.indexOf('\n  build-images:\n'),
			prWorkflow.indexOf('\n  can-merge:\n'),
		)

		expect(buildImagesJob).not.toMatch(/\n {4}needs:/)
		expect(buildImagesJob).toContain('upload-artifact: false')
		expect(buildImagesJob).toContain('download-artifact: false')
		expect(prWorkflow).not.toContain('\n  build-packages:\n')
		expect(prWorkflow).not.toContain('\n  docker-build:\n')
	})

	it('builds deploy artifacts beside tests and builds each Docker image once', () => {
		const buildPackagesJob = deployWorkflow.slice(
			deployWorkflow.indexOf('\n  build-packages:\n'),
			deployWorkflow.indexOf('\n  docker-build:\n'),
		)
		const dockerBuildJob = deployWorkflow.slice(deployWorkflow.indexOf('\n  docker-build:\n'))

		expect(buildPackagesJob).not.toMatch(/\n {4}needs:/)
		expect(deployWorkflow).toContain('needs: [test, build-packages]')
		expect(dockerBuildJob).toContain('needs: [build-packages, release]')
		expect(dockerBuildJob).toContain('Resolve image parameters')
		expect(dockerBuildJob).toContain(
			['if: $', "{{ steps.image_parameters.outputs.push == 'true' }}"].join(''),
		)
		expect(dockerBuildJob).toContain(
			['push: $', '{{ steps.image_parameters.outputs.push }}'].join(''),
		)
		expect(dockerBuildJob).toContain('cache-write: true')
		expect(deployWorkflow).not.toContain('\n  docker-publish:\n')
		expect(
			deployWorkflow.match(/uses: \.\/\.github\/actions\/build-docker-image/g),
		).toHaveLength(1)
	})

	it('uses per-image BuildKit caches written only by deploy runs', () => {
		expect(buildDockerImageAction).toContain('cache-write:')
		expect(buildDockerImageAction).toContain('uses: docker/setup-buildx-action@v4')
		expect(buildDockerImageAction).toContain('driver: docker-container')
		expect(buildDockerImageAction.indexOf('uses: docker/setup-buildx-action@v4')).toBeLessThan(
			buildDockerImageAction.indexOf('uses: docker/build-push-action@v7'),
		)
		expect(buildDockerImageAction).toContain(
			['cache-from: type=gha,scope=$', '{{ inputs.name }}'].join(''),
		)
		expect(buildDockerImageAction).toContain(
			[
				'cache-to: $',
				"{{ inputs.cache-write == 'true' && format('type=gha,mode=max,scope={0},ignore-error=true', inputs.name) || '' }}",
			].join(''),
		)
		expect(prWorkflow).not.toContain('cache-write: true')
		expect(deployWorkflow).toContain('cache-write: true')
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
