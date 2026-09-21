import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { rustTargets } from './targets.mjs'
const outputPath = process.argv[2]
if (!outputPath) throw new Error('Usage: node scripts/release/plan.mjs OUTPUT_PATH')

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function runSemantic(target, mode) {
	const result = spawnSync(process.execPath, ['scripts/release/semantic-target.mjs', mode], {
		encoding: 'utf8',
		env: { ...process.env, RELEASE_TARGET: target },
	})
	if (result.status !== 0) {
		process.stderr.write(result.stderr)
		throw new Error(`semantic-release ${mode} failed for ${target}`)
	}
	const line = result.stdout.split('\n').find((entry) => entry.startsWith('ZC_RELEASE_RESULT='))
	if (!line) throw new Error(`semantic-release returned no result for ${target}`)
	return JSON.parse(line.slice('ZC_RELEASE_RESULT='.length))
}

const sha = git('rev-parse', 'HEAD')
const atHead = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean)
const targets = ['ts', ...Object.keys(rustTargets)]
const releases = []

for (const target of targets) {
	const prefix = target === 'ts' ? '' : `${target}@`
	const tagPattern = target === 'ts' ? /^\d+\.\d+\.\d+$/ : new RegExp(`^${target}@\\d+\\.\\d+\\.\\d+$`)
	const existing = atHead.filter((tag) => tagPattern.test(tag))
	if (existing.length > 1) throw new Error(`Multiple ${target} release tags point at HEAD`)
	if (existing.length === 1) {
		releases.push({ target, version: existing[0].slice(prefix.length), tag: existing[0], existing: true })
		continue
	}

	const reachable = git('tag', '--merged', 'HEAD', '--list', target === 'ts' ? '3.*' : `${target}@*`)
		.split('\n')
		.some((tag) => tagPattern.test(tag))
	if (!reachable) {
		const version = target === 'ts' ? '3.0.1' : '3.0.0'
		const tag = `${prefix}${version}`
		const tagSha = git('tag', '--list', tag) ? git('rev-list', '-n', '1', tag) : ''
		if (tagSha && tagSha !== sha) throw new Error(`Bootstrap tag ${tag} already points at another commit`)
		releases.push({ target, version, tag, bootstrap: true })
		continue
	}
	const planned = runSemantic(target, 'plan')
	if (planned) releases.push({ target, ...planned })
}

const images = releases.flatMap((release) => {
	if (release.target === 'ts') {
		return [
			{ name: 'postgraphile', version: release.version, dockerfile: 'Dockerfile.postgraphile', artifact: 'package-output-postgraphile', downloadPath: 'dist', expectedPath: 'dist/zeepcentraal-postgraphile', cloneSuperLeague: false },
			{ name: 'web', version: release.version, dockerfile: 'Dockerfile.web', artifact: 'package-output-web', downloadPath: 'packages/web/.output', expectedPath: 'packages/web/.output/server/index.mjs', cloneSuperLeague: false },
		]
	}
	const service = rustTargets[release.target]
	return [{ name: release.target, version: release.version, dockerfile: service.dockerfile, artifact: 'rust-binaries', downloadPath: 'dist', expectedPath: `dist/${service.binary}`, cloneSuperLeague: Boolean(service.cloneSuperLeague) }]
})

const plan = { sha, releases, images }
writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`)
if (process.env.GITHUB_OUTPUT) {
	appendFileSync(process.env.GITHUB_OUTPUT, `images=${JSON.stringify({ include: images })}\ncount=${images.length}\n`)
}
process.stdout.write(`Planned ${releases.length} releases and ${images.length} images\n`)
