// Own one disposable PostgreSQL container. Never use checkout or production DB credentials.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const name = `zc-web-auth-test-${process.pid}`
function docker(...args: string[]) {
	const result = spawnSync('docker', args, { encoding: 'utf8' })
	if (result.status !== 0) throw new Error(result.stderr || 'Docker command failed')
	return result.stdout.trim()
}
let exitCode = 1
try {
	docker(
		'run',
		'--rm',
		'-d',
		'--name',
		name,
		'-p',
		'127.0.0.1::5432',
		'-e',
		'POSTGRES_PASSWORD=fake-auth-password',
		'-e',
		'POSTGRES_DB=auth_fixture',
		'postgres:17-alpine',
	)
	const port = docker('port', name, '5432/tcp').split(':').at(-1)
	if (!port || !/^\d+$/.test(port)) throw new Error('Missing auth fixture PostgreSQL port')
	const child = Bun.spawn(
		[
			process.execPath,
			'--bun',
			'x',
			'playwright',
			'test',
			'--config',
			'playwright.auth.config.ts',
			...process.argv.slice(2),
		],
		{
			cwd: fileURLToPath(new URL('../..', import.meta.url)),
			stdout: 'inherit',
			stderr: 'inherit',
			env: {
				...process.env,
				WEB_AUTH_TEST_DATABASE_URL: `postgres://postgres:fake-auth-password@127.0.0.1:${port}/auth_fixture`,
			},
		},
	)
	exitCode = await child.exited
} finally {
	docker('rm', '-f', name)
}
process.exit(exitCode)
