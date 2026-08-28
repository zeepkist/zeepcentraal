import { resolve } from 'node:path'
import { aot } from 'elysia/plugin/aot/bun'

process.env.NODE_ENV = 'production'
process.env.DATABASE_URL = 'postgres://aot:aot@127.0.0.1:5432/aot'
process.env.POSTGRAPHILE_DATABASE_URL = 'postgres://aot:aot@127.0.0.1:5432/aot'
delete process.env.POSTGRAPHILE_SUPERUSER_DATABASE_URL

const entry = resolve(import.meta.dir, '../src/index.ts')
const appEntry = resolve(import.meta.dir, '../src/app.ts')
const outfile = resolve(import.meta.dir, '../../../dist/zeepcentraal-postgraphile')

const result = await Bun.build({
	entrypoints: [entry],
	target: 'bun',
	minify: true,
	splitting: true,
	plugins: [aot(appEntry, { target: 'bun' })],
	compile: {
		outfile,
		execArgv: ['--smol', '--user-agent=ZeepCentraal'],
	},
})

for (const log of result.logs) {
	console.error(log)
}

process.exit(result.success ? 0 : 1)
