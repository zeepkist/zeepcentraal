import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// @ts-expect-error -- package does not publish TypeScript declarations
import { generateNotes } from '@semantic-release/release-notes-generator'

const repositoryRoot = new URL('../', import.meta.url)
const releaseConfig = readFileSync(new URL('release.config.cjs', repositoryRoot), 'utf8')
const deployWorkflow = readFileSync(new URL('.github/workflows/deploy.yml', repositoryRoot), 'utf8')
const packageNames = [
	'core',
	'database',
	'discord',
	'graphql',
	'import-zsl',
	'jobs',
	'postgraphile',
	'server',
	'telemetry',
	'web',
	'workshop',
]

function readPackage(relativePath: string): {
	version?: string
	scripts?: Record<string, string>
	devDependencies?: Record<string, string>
} {
	return JSON.parse(readFileSync(new URL(relativePath, repositoryRoot), 'utf8'))
}

describe('unified releases', () => {
	test('runs semantic-release once from the repository root', () => {
		const rootPackage = readPackage('package.json')

		expect(rootPackage.scripts?.release).toBe('semantic-release')
		expect(
			Object.keys(rootPackage.scripts ?? {}).filter((script) =>
				script.startsWith('release:'),
			),
		).toEqual([])
		expect(rootPackage.devDependencies?.['semantic-release-monorepo']).toBeUndefined()
		expect(releaseConfig).toContain("branches: ['develop']")
		expect(releaseConfig).toContain(["tagFormat: '", '$', "{version}'"].join(''))
	})

	test('always runs semantic-release in the develop deployment workflow', () => {
		const releaseJob = deployWorkflow.slice(
			deployWorkflow.indexOf('\n  release:\n'),
			deployWorkflow.indexOf('\n  build-packages:\n'),
		)
		const semanticReleaseStep = releaseJob.slice(
			releaseJob.indexOf('      - name: Run semantic release'),
			releaseJob.indexOf('      - name: Resolve release version'),
		)

		expect(deployWorkflow).toContain('branches: [develop]')
		expect(releaseJob).not.toContain('Check release history')
		expect(semanticReleaseStep).toContain('run: bun run release')
		expect(semanticReleaseStep).not.toContain('if:')
	})

	test('generates conventional commits in GitHub release notes', async () => {
		const rootPackage = readPackage('package.json')
		const featureHash = '4861700722388474105a17197895bf3e3b308f42'
		const fixHash = '1234567890abcdef1234567890abcdef12345678'
		const notes = await generateNotes(
			{ preset: 'conventionalcommits' },
			{
				commits: [
					{
						hash: featureHash,
						message:
							'feat(discord): order rank changes in ascending order and fix last/previous buttons always disabled',
					},
					{ hash: fixHash, message: 'fix(web): restore release details' },
					{
						hash: 'fedcba9876543210fedcba9876543210fedcba98',
						message: 'chore: refresh dependencies',
					},
				],
				lastRelease: { gitTag: '1.17.0' },
				nextRelease: { gitTag: '1.18.0', version: '1.18.0' },
				options: { repositoryUrl: 'https://github.com/zeepkist/zeepcentraal.git' },
				cwd: fileURLToPath(repositoryRoot),
			},
		)

		expect(rootPackage.devDependencies?.['conventional-changelog-conventionalcommits']).toBe(
			'~9.3.1',
		)
		expect(notes).toContain(
			'[1.18.0](https://github.com/zeepkist/zeepcentraal/compare/1.17.0...1.18.0)',
		)
		expect(notes).toContain('### Features')
		expect(notes).toContain(
			'**discord:** order rank changes in ascending order and fix last/previous buttons always disabled',
		)
		expect(notes).toContain(
			`[4861700](https://github.com/zeepkist/zeepcentraal/commit/${featureHash})`,
		)
		expect(notes).toContain('### Bug Fixes')
		expect(notes).toContain('**web:** restore release details')
		expect(notes).toContain(
			`[1234567](https://github.com/zeepkist/zeepcentraal/commit/${fixHash})`,
		)
		expect(notes).not.toContain('refresh dependencies')
	})

	test('keeps private workspace packages outside independent release streams', () => {
		for (const packageName of packageNames) {
			const packagePath = `packages/${packageName}`
			const packageManifest = readPackage(`${packagePath}/package.json`)

			expect(packageManifest.version).toBeUndefined()
			expect(packageManifest.scripts?.release).toBeUndefined()
			expect(existsSync(new URL(`${packagePath}/.releaserc.cjs`, repositoryRoot))).toBe(false)
		}
	})
})
