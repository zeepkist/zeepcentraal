import { execFileSync } from 'node:child_process'
import { affects } from './targets.mjs'

function changedPaths(hash, cwd) {
	return execFileSync(
		'git',
		['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-m', hash],
		{
			cwd,
			encoding: 'utf8',
		},
	)
		.trim()
		.split('\n')
		.filter(Boolean)
}

function relevantCommits(context) {
	const target = process.env.RELEASE_TARGET || 'ts'
	return context.commits.filter((commit) =>
		changedPaths(commit.hash, context.cwd ?? process.cwd()).some((path) =>
			affects(target, path),
		),
	)
}

function hasConventionalHeader(message) {
	return /^[a-z][\w-]*(?:\([^)\n]+\))?!?:\s+\S/.test(message.split('\n', 1)[0])
}

async function analyzeCommits(_config, context) {
	const commits = relevantCommits(context)
	if (!commits.length) return null
	const { analyzeCommits: analyze } = await import('@semantic-release/commit-analyzer')
	const result = await analyze(
		{
			preset: 'conventionalcommits',
			releaseRules: [
				{ breaking: true, release: 'major' },
				{ type: 'feat', release: 'minor' },
				{ type: 'fix', release: 'patch' },
				{ type: 'perf', release: 'patch' },
				{ type: 'chore', scope: 'deps', release: 'patch' },
			],
		},
		{ ...context, commits },
	)
	if (result) return result
	const target = process.env.RELEASE_TARGET || 'ts'
	// GitHub squash titles may discard conventional headers for relevant code changes.
	return commits.some(
		(commit) =>
			!hasConventionalHeader(commit.message) ||
			changedPaths(commit.hash, context.cwd ?? process.cwd()).some(
				(path) =>
					affects(target, path) &&
					/(^Dockerfile\.|\/Dockerfile$|^(Cargo|bun)\.lock$)/.test(path),
			),
	)
		? 'patch'
		: null
}

async function generateNotes(_config, context) {
	const { generateNotes: generate } = await import('@semantic-release/release-notes-generator')
	return generate(
		{ preset: 'conventionalcommits' },
		{ ...context, commits: relevantCommits(context) },
	)
}

export { analyzeCommits, generateNotes }
