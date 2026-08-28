import { resolve } from 'node:path'
import { aot } from 'elysia/plugin/aot/bun'

process.env.NODE_ENV = 'production'
process.env.DATABASE_URL = 'postgres://aot:aot@127.0.0.1:5432/aot'
process.env.JWT_SECRET = 'aot-build-only-jwt-secret'.padEnd(32, 'x')
process.env.TRIGGER_JOB_TOKEN = 'aot-build-only-job-token'.padEnd(32, 'x')
process.env.DISCORD_BOT_API_TOKEN = 'aot-build-only-discord-token'.padEnd(32, 'x')

const entry = resolve(import.meta.dir, '../src/index.ts')
const appEntry = resolve(import.meta.dir, '../src/app.ts')
const outfile = resolve(import.meta.dir, '../../../dist/zeepcentraal-server')

const result = await Bun.build({
	entrypoints: [entry],
	target: 'bun',
	minify: true,
	splitting: true,
	external: [
		'@doctormckay/steam-crypto',
		'@napi-rs/lzma',
		'@napi-rs/lzma/lzma',
		'lzma',
		'xxhash-addon',
	],
	plugins: [aot(appEntry, { target: 'bun', strip: false })],
	compile: {
		outfile,
		execArgv: ['--smol', '--user-agent=ZeepCentraal'],
	},
})

for (const log of result.logs) {
	console.error(log)
}

process.exit(result.success ? 0 : 1)
