import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { enforceCacheBudget } from './cache-budget.mjs'
import { checkVersionInfo, highestRequiredGlibc } from './check-rust-abi.mjs'
import { analyzeCommits } from './impact.mjs'
import { publishPlan } from './publish.mjs'
import { affects, rustTargets } from './targets.mjs'

function git(cwd, ...args) {
	const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
		cwd,
		encoding: 'utf8',
	})
	assert.equal(result.status, 0, result.stderr)
	return result.stdout.trim()
}

test('cache budget survives shutdown timeout but rejects failed or incomplete GC', () => {
	const report = {
		success: true,
		skipped: false,
		disk: { store_bytes: 100, store_limit_bytes: 200 },
	}
	const invocations = []
	const runner = (result) => (command, args, options) => {
		assert.equal(command, 'kache')
		invocations.push(args)
		if (args[0] === 'daemon') {
			assert.equal(options.timeout, 30_000)
			return { status: 1, stderr: 'error: daemon connection timed out' }
		}
		assert.deepEqual(args, ['gc', '--json'])
		assert.equal(options.timeout, 120_000)
		return result
	}
	enforceCacheBudget(runner({ status: 0, stdout: JSON.stringify(report) }))
	assert.deepEqual(invocations, [
		['daemon', 'stop'],
		['gc', '--json'],
	])
	assert.throws(() => enforceCacheBudget(runner({ status: 1 })), /Kache GC failed/)
	assert.throws(() => enforceCacheBudget(runner({ status: null })), /Kache GC failed/)
	assert.throws(
		() =>
			enforceCacheBudget(
				runner({ status: 0, stdout: JSON.stringify({ ...report, skipped: true }) }),
			),
		/GC did not complete/,
	)
	assert.throws(
		() =>
			enforceCacheBudget(
				runner({
					status: 0,
					stdout: JSON.stringify({
						...report,
						disk: { store_bytes: 201, store_limit_bytes: 200 },
					}),
				}),
			),
		/store exceeds budget/,
	)
	assert.throws(
		() =>
			enforceCacheBudget(
				runner({ status: 0, stdout: JSON.stringify({ ...report, disk: {} }) }),
			),
		/invalid store budget/,
	)
})

test('publisher keeps planned tags and notes after develop advances, and retries safely', {
	timeout: 30_000,
}, () => {
	const root = mkdtempSync(join(tmpdir(), 'zc-release-publish-'))
	const cwd = join(root, 'checkout')
	const remote = join(root, 'origin.git')
	try {
		git(root, 'init', '--bare', '-q', remote)
		git(root, 'init', '-q', cwd)
		git(cwd, 'config', 'user.name', 'Release Test')
		git(cwd, 'config', 'user.email', 'release@example.test')
		git(cwd, 'remote', 'add', 'origin', remote)
		writeFileSync(join(cwd, 'source.txt'), 'planned\n')
		git(cwd, 'add', 'source.txt')
		git(cwd, 'commit', '-qm', 'feat: planned release')
		const sha = git(cwd, 'rev-parse', 'HEAD')
		git(cwd, 'push', 'origin', 'HEAD:refs/heads/develop')
		writeFileSync(join(cwd, 'source.txt'), 'newer\n')
		git(cwd, 'commit', '-qam', 'fix: newer change')
		const newer = git(cwd, 'rev-parse', 'HEAD')
		git(cwd, 'push', 'origin', 'HEAD:refs/heads/develop')
		git(cwd, 'checkout', '--detach', sha)
		const releases = [
			{
				target: 'ts',
				version: '3.14.0',
				tag: '3.14.0',
				notes: '## Planned notes\n\nOriginal content.\n',
			},
			{
				target: 'zc-server',
				version: '3.0.1',
				tag: 'zc-server@3.0.1',
				notes: 'Server fix.\n',
			},
		]
		const plan = { sha, releases }
		const published = new Set()
		const created = []
		let failServerOnce = true
		const run = (command, args, options) => {
			assert.equal(command, 'gh')
			if (args[1] === 'view') return { status: published.has(args[2]) ? 0 : 1 }
			assert.equal(args[1], 'create')
			assert.deepEqual(args.slice(3), ['--target', sha, '--notes-file', '-'])
			if (args[2] === 'zc-server@3.0.1' && failServerOnce) {
				failServerOnce = false
				return { status: 1 }
			}
			created.push({ tag: args[2], notes: options.input })
			published.add(args[2])
			return { status: 0 }
		}
		assert.throws(
			() => publishPlan(plan, { cwd, run }),
			/GitHub release creation failed: zc-server@3\.0\.1/,
		)
		assert.equal(created.length, 1)
		publishPlan(plan, { cwd, run })
		assert.deepEqual(
			created,
			releases.map(({ tag, notes }) => ({ tag, notes })),
		)
		for (const release of releases) {
			assert.equal(git(remote, 'rev-list', '-n', '1', release.tag), sha)
		}
		assert.equal(git(remote, 'rev-parse', 'refs/heads/develop'), newer)
		publishPlan(plan, { cwd, run })
		assert.equal(created.length, 2)

		// Validate every tag before creating any tag or GitHub release.
		git(cwd, 'tag', 'zc-jobs@3.0.1', newer)
		const conflict = {
			sha,
			releases: [
				{ target: 'ts', version: '3.15.0', tag: '3.15.0', notes: 'Unpublished.' },
				{ target: 'zc-jobs', version: '3.0.1', tag: 'zc-jobs@3.0.1', notes: 'Conflict.' },
			],
		}
		assert.throws(
			() => publishPlan(conflict, { cwd, run }),
			/Tag zc-jobs@3\.0\.1 points elsewhere/,
		)
		assert.equal(git(cwd, 'tag', '--list', '3.15.0'), '')
		assert.equal(created.length, 2)
		assert.throws(() => publishPlan({ ...plan, sha: newer }, { cwd, run }), /SHA differs/)
		assert.throws(
			() =>
				publishPlan(
					{ sha, releases: [{ ...releases[0], notes: undefined }] },
					{ cwd, run },
				),
			/Release plan has no notes for ts/,
		)
	} finally {
		rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
	}
})

test('release paths separate retained TypeScript services from Rust services', () => {
	assert.equal(Object.keys(rustTargets).length, 8)
	assert.equal(affects('zc-streamkist', 'crates/streamkist/src/runtime.rs'), true)
	assert.equal(affects('zc-streamkist', 'crates/database/src/services/streamkist.rs'), true)
	assert.equal(affects('zc-streamkist', 'Dockerfile.streamkist'), true)
	assert.equal(affects('zc-streamkist', 'crates/discord/src/runtime.rs'), false)
	assert.equal(affects('ts', 'packages/web/app/app.vue'), true)
	assert.equal(affects('ts', 'packages/postgraphile/src/index.ts'), true)
	assert.equal(affects('ts', 'packages/server/src/server.ts'), false)
	assert.equal(affects('zc-server', 'crates/database/src/lib.rs'), true)
	assert.equal(affects('zc-server', 'vendor/steam-client-rs/src/services/appauth.rs'), true)
	assert.equal(affects('zc-server', 'vendor/steam-client-rs/ZEEPCENTRAAL-PATCH.md'), true)
	for (const path of [
		'vendor/steam-auth-rs/src/transport/websocket_cm.rs',
		'vendor/steam-cm-provider/src/lib.rs',
	]) {
		assert.equal(affects('zc-server', path), true)
		assert.equal(affects('ts', path), false)
		for (const target of Object.keys(rustTargets).filter((name) => name !== 'zc-server')) {
			assert.equal(affects(target, path), false)
		}
	}
	for (const target of Object.keys(rustTargets).filter((name) => name !== 'zc-server')) {
		assert.equal(affects(target, 'vendor/steam-client-rs/src/services/appauth.rs'), false)
	}
	assert.equal(affects('ts', 'vendor/steam-client-rs/src/services/appauth.rs'), false)
	assert.equal(affects('zc-jobs', 'crates/database/src/lib.rs'), true)
	assert.equal(affects('zc-discord', 'crates/database/src/lib.rs'), false)
	assert.equal(affects('zc-migrate', 'packages/database/drizzle/0001.sql'), true)
	assert.equal(affects('zc-migrate', 'crates/database/src/adoption.rs'), true)
	assert.equal(affects('zc-migrate', 'crates/telemetry/src/lib.rs'), true)
	assert.equal(affects('zc-discord', 'Dockerfile.discord'), true)
	assert.equal(affects('zc-inspector-zeep', 'Dockerfile.inspector-zeep'), true)
	assert.equal(affects('zc-server', 'packages/web/app/app.vue'), false)
	for (const target of Object.keys(rustTargets)) {
		assert.equal(affects(target, '.github/workflows/deploy.yml'), true)
	}
	assert.equal(affects('ts', '.github/workflows/deploy.yml'), false)
})

for (const [name, relativeSource] of [
	['steam-client-rs', 'src/services/appauth.rs'],
	['steam-auth-rs', 'src/transport/websocket_cm.rs'],
	['steam-cm-provider', 'src/lib.rs'],
]) {
	test(`vendored ${name} fix bumps only server release`, { timeout: 30_000 }, async () => {
		const root = mkdtempSync(join(tmpdir(), 'zc-release-steam-'))
		const previousTarget = process.env.RELEASE_TARGET
		try {
			git(root, 'init', '-q')
			const source = join(root, 'vendor', name, relativeSource)
			mkdirSync(dirname(source), { recursive: true })
			writeFileSync(source, 'old\n')
			git(root, 'add', '.')
			git(
				root,
				'-c',
				'user.name=Release Test',
				'-c',
				'user.email=release@example.test',
				'commit',
				'-qm',
				'chore: baseline',
			)
			writeFileSync(source, 'fixed\n')
			git(root, 'add', '.')
			git(
				root,
				'-c',
				'user.name=Release Test',
				'-c',
				'user.email=release@example.test',
				'commit',
				'-qm',
				'fix(server): send complete Steam encrypted ticket',
			)
			const context = {
				cwd: root,
				commits: [
					{
						hash: git(root, 'rev-parse', 'HEAD'),
						message: 'fix(server): send complete Steam encrypted ticket',
					},
				],
				logger: { log() {} },
			}
			process.env.RELEASE_TARGET = 'zc-server'
			assert.equal(await analyzeCommits({}, context), 'patch')
			for (const target of Object.keys(rustTargets).filter((name) => name !== 'zc-server')) {
				process.env.RELEASE_TARGET = target
				assert.equal(await analyzeCommits({}, context), null, target)
			}
			process.env.RELEASE_TARGET = 'ts'
			assert.equal(await analyzeCommits({}, context), null)
		} finally {
			if (previousTarget === undefined) delete process.env.RELEASE_TARGET
			else process.env.RELEASE_TARGET = previousTarget
			rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
		}
	})
}

test('Rust ABI gate rejects glibc newer than oldest runtime', () => {
	assert.deepEqual(highestRequiredGlibc('GLIBC_2.9 GLIBC_2.35 GLIBC_2.17'), [2, 35])
	assert.equal(checkVersionInfo('GLIBC_2.35 GLIBC_2.17', 'zc-jobs'), 'GLIBC_2.35')
	assert.equal(checkVersionInfo('', 'static-binary'), 'no dynamic glibc requirement')
	assert.throws(
		() => checkVersionInfo('GLIBC_2.38', 'zc-server'),
		/zc-server requires GLIBC_2\.38; oldest runtime provides GLIBC_2\.35/,
	)
})

test('GitHub squash title still releases affected Rust services', { timeout: 30_000 }, async () => {
	const root = mkdtempSync(join(tmpdir(), 'zc-release-impact-'))
	const previousTarget = process.env.RELEASE_TARGET
	try {
		git(root, 'init', '-q')
		mkdirSync(join(root, 'crates/database/src'), { recursive: true })
		writeFileSync(join(root, 'crates/database/src/adoption.rs'), 'old\n')
		git(root, 'add', '.')
		git(
			root,
			'-c',
			'user.name=Release Test',
			'-c',
			'user.email=release@example.test',
			'commit',
			'-qm',
			'chore: baseline',
		)
		writeFileSync(join(root, 'crates/database/src/adoption.rs'), 'fixed\n')
		git(root, 'add', '.')
		git(
			root,
			'-c',
			'user.name=Release Test',
			'-c',
			'user.email=release@example.test',
			'commit',
			'-qm',
			'Feat/rust (#110)',
		)
		const hash = git(root, 'rev-parse', 'HEAD')
		const context = {
			cwd: root,
			commits: [{ hash, message: 'Feat/rust (#110)' }],
			logger: { log() {} },
		}
		for (const target of [
			'zc-server',
			'zc-jobs',
			'zc-migrate',
			'zc-lobby-host',
			'zc-inspector-zeep',
			'zc-import-zsl',
		]) {
			process.env.RELEASE_TARGET = target
			assert.equal(await analyzeCommits({}, context), 'patch', target)
		}
		process.env.RELEASE_TARGET = 'zc-discord'
		assert.equal(await analyzeCommits({}, context), null)
		process.env.RELEASE_TARGET = 'ts'
		assert.equal(await analyzeCommits({}, context), null)

		process.env.RELEASE_TARGET = 'zc-migrate'
		context.commits[0].message = 'feat(database): add feature'
		assert.equal(await analyzeCommits({}, context), 'minor')
		context.commits[0].message = 'chore(database): tidy internals'
		assert.equal(await analyzeCommits({}, context), null)

		mkdirSync(join(root, '.github/workflows'), { recursive: true })
		writeFileSync(join(root, '.github/workflows/deploy.yml'), 'runs-on: ubuntu-22.04\n')
		git(root, 'add', '.')
		git(
			root,
			'-c',
			'user.name=Release Test',
			'-c',
			'user.email=release@example.test',
			'commit',
			'-qm',
			'fix(ci): build compatible Rust binaries',
		)
		context.commits = [
			{
				hash: git(root, 'rev-parse', 'HEAD'),
				message: 'fix(ci): build compatible Rust binaries',
			},
		]
		for (const target of Object.keys(rustTargets)) {
			process.env.RELEASE_TARGET = target
			assert.equal(await analyzeCommits({}, context), 'patch', target)
		}
		process.env.RELEASE_TARGET = 'ts'
		assert.equal(await analyzeCommits({}, context), null)
	} finally {
		if (previousTarget === undefined) delete process.env.RELEASE_TARGET
		else process.env.RELEASE_TARGET = previousTarget
		rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
	}
})

test('each Rust image copies its staged service binary', () => {
	const pullRequestWorkflow = readFileSync('.github/workflows/pr-validate.yml', 'utf8')
	for (const [name, service] of Object.entries(rustTargets)) {
		assert.equal(existsSync(service.dockerfile), true, `${name} Dockerfile missing`)
		assert.ok(
			pullRequestWorkflow.includes(`name: ${name}, file: ${service.dockerfile},`),
			`${name} PR image path differs from release target`,
		)
		const dockerfile = readFileSync(service.dockerfile, 'utf8')
		assert.match(
			dockerfile,
			new RegExp(`COPY --chmod=755 dist/${service.binary} `),
			`${name} binary staging mismatch`,
		)
		assert.match(dockerfile, /OPENTELEMETRY_SERVICE_VERSION=\$SERVICE_VERSION/)
	}
	assert.match(
		readFileSync('Dockerfile.migrate', 'utf8'),
		/COPY packages\/database\/drizzle drizzle/,
	)
	assert.match(
		readFileSync('Dockerfile.zsl', 'utf8'),
		/COPY super_league_data \/data\/super_league_data/,
	)
})

test('Rust release stamping changes only planned crate and lock entry', () => {
	const root = mkdtempSync(join(tmpdir(), 'zc-release-stamp-'))
	try {
		mkdirSync(join(root, 'crates/server'), { recursive: true })
		writeFileSync(
			join(root, 'crates/server/Cargo.toml'),
			'[package]\nname = "zc-server"\nversion = "3.0.0"\n',
		)
		writeFileSync(
			join(root, 'Cargo.lock'),
			'[[package]]\nname = "zc-server"\nversion = "3.0.0"\n\n[[package]]\nname = "zc-core"\nversion = "0.1.0"\n',
		)
		writeFileSync(
			join(root, 'plan.json'),
			JSON.stringify({ releases: [{ target: 'zc-server', version: '3.2.1' }] }),
		)
		const script = fileURLToPath(new URL('./stamp.mjs', import.meta.url))
		const result = spawnSync(process.execPath, [script, join(root, 'plan.json')], {
			cwd: root,
			encoding: 'utf8',
		})
		assert.equal(result.status, 0, result.stderr)
		assert.match(
			readFileSync(join(root, 'crates/server/Cargo.toml'), 'utf8'),
			/version = "3\.2\.1"/,
		)
		assert.match(
			readFileSync(join(root, 'Cargo.lock'), 'utf8'),
			/name = "zc-server"\nversion = "3\.2\.1"/,
		)
		assert.match(
			readFileSync(join(root, 'Cargo.lock'), 'utf8'),
			/name = "zc-core"\nversion = "0\.1\.0"/,
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('Streamkist binary reaches both workflows and Docker context', () => {
	assert.match(readFileSync('.dockerignore', 'utf8'), /^!dist\/zeepcentraal-streamkist$/m)
	for (const workflow of ['pr-validate.yml', 'deploy.yml']) {
		const content = readFileSync(`.github/workflows/${workflow}`, 'utf8')
		assert.ok(content.includes('-p zc-streamkist'))
		assert.ok(content.includes('lobby-host,discord,streamkist,inspector-zeep'))
	}
})
