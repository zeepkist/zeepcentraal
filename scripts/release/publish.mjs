import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) throw new Error('Usage: node scripts/release/publish.mjs PLAN_PATH')
const plan = JSON.parse(readFileSync(path, 'utf8'))
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
if (git('rev-parse', 'HEAD') !== plan.sha) throw new Error('Release plan SHA differs from checkout')

for (const release of plan.releases) {
	if (release.bootstrap && !release.existing) {
		git('tag', release.tag, plan.sha)
		git('push', 'origin', `refs/tags/${release.tag}`)
	}
	if (release.bootstrap || release.existing) {
		if (git('rev-list', '-n', '1', release.tag) !== plan.sha) throw new Error(`Tag ${release.tag} points elsewhere`)
		const found = spawnSync('gh', ['release', 'view', release.tag], { encoding: 'utf8' })
		if (found.status !== 0) {
			const created = spawnSync('gh', ['release', 'create', release.tag, '--target', plan.sha, '--generate-notes'], { encoding: 'utf8', stdio: 'inherit' })
			if (created.status !== 0) throw new Error(`GitHub release creation failed: ${release.tag}`)
		}
		continue
	}
	const result = spawnSync(process.execPath, ['scripts/release/semantic-target.mjs', 'publish'], {
		encoding: 'utf8',
		env: { ...process.env, RELEASE_TARGET: release.target },
	})
	if (result.status !== 0) {
		process.stderr.write(result.stderr)
		throw new Error(`semantic-release publish failed for ${release.target}`)
	}
	const line = result.stdout.split('\n').find((entry) => entry.startsWith('ZC_RELEASE_RESULT='))
	const published = line && JSON.parse(line.slice('ZC_RELEASE_RESULT='.length))
	if (!published || published.version !== release.version || published.tag !== release.tag) {
		throw new Error(`semantic-release changed planned version for ${release.target}`)
	}
}
