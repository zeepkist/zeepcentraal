import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { rustTargets } from './targets.mjs'

export function publishPlan(plan, { cwd = process.cwd(), run = spawnSync } = {}) {
	const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
	if (git('rev-parse', 'HEAD') !== plan.sha)
		throw new Error('Release plan SHA differs from checkout')

	// Validate every planned tag before publishing any release.
	const tags = new Set()
	for (const release of plan.releases) {
		if (release.target !== 'ts' && !Object.hasOwn(rustTargets, release.target))
			throw new Error(`Unknown release target: ${release.target}`)
		const prefix = release.target === 'ts' ? '' : `${release.target}@`
		if (
			!/^\d+\.\d+\.\d+$/.test(release.version) ||
			release.tag !== `${prefix}${release.version}`
		)
			throw new Error(`Invalid planned tag: ${release.tag}`)
		if (tags.has(release.tag)) throw new Error(`Duplicate planned tag: ${release.tag}`)
		tags.add(release.tag)
		if (!release.bootstrap && !release.existing && typeof release.notes !== 'string')
			throw new Error(`Release plan has no notes for ${release.target}`)
		if (git('tag', '--list', release.tag)) {
			if (git('rev-list', '-n', '1', release.tag) !== plan.sha)
				throw new Error(`Tag ${release.tag} points elsewhere`)
		} else if (release.existing) {
			throw new Error(`Existing tag ${release.tag} is missing`)
		}
	}

	for (const release of plan.releases) {
		if (!git('tag', '--list', release.tag)) git('tag', release.tag, plan.sha)
		// Push only the frozen tag. develop may advance while images are being built.
		// Re-pushing the same tag also recovers an interrupted publish.
		git('push', 'origin', `refs/tags/${release.tag}`)
		const found = run('gh', ['release', 'view', release.tag], { cwd, encoding: 'utf8' })
		if (found.status !== 0) {
			const notes =
				typeof release.notes === 'string' ? ['--notes-file', '-'] : ['--generate-notes']
			const created = run(
				'gh',
				['release', 'create', release.tag, '--target', plan.sha, ...notes],
				{
					cwd,
					encoding: 'utf8',
					stdio: ['pipe', 'inherit', 'inherit'],
					input: release.notes,
				},
			)
			if (created.status !== 0)
				throw new Error(`GitHub release creation failed: ${release.tag}`)
		}
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const path = process.argv[2]
	if (!path) throw new Error('Usage: node scripts/release/publish.mjs PLAN_PATH')
	publishPlan(JSON.parse(readFileSync(path, 'utf8')))
}
