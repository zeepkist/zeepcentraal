import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkVersionInfo, highestRequiredGlibc } from './check-rust-abi.mjs'
import { analyzeCommits } from './impact.mjs'
import { affects, rustTargets } from './targets.mjs'

function git(cwd, ...args) {
	const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
		cwd,
		encoding: 'utf8',
	})
	assert.equal(result.status, 0, result.stderr)
	return result.stdout.trim()
}

test('release paths separate retained TypeScript services from Rust services', () => {
	assert.equal(Object.keys(rustTargets).length, 7)
	assert.equal(affects('ts', 'packages/web/app/app.vue'), true)
	assert.equal(affects('ts', 'packages/postgraphile/src/index.ts'), true)
	assert.equal(affects('ts', 'packages/server/src/server.ts'), false)
	assert.equal(affects('zc-server', 'crates/database/src/lib.rs'), true)
	assert.equal(affects('zc-server', 'vendor/steam-client-rs/src/services/appauth.rs'), true)
	assert.equal(affects('zc-server', 'vendor/steam-client-rs/ZEEPCENTRAAL-PATCH.md'), true)
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

test('vendored Steam client fix bumps only server release', { timeout: 30_000 }, async () => {
	const root = mkdtempSync(join(tmpdir(), 'zc-release-steam-'))
	const previousTarget = process.env.RELEASE_TARGET
	try {
		git(root, 'init', '-q')
		mkdirSync(join(root, 'vendor/steam-client-rs/src/services'), { recursive: true })
		const source = join(root, 'vendor/steam-client-rs/src/services/appauth.rs')
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
