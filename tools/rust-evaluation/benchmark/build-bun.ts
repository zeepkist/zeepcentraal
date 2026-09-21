import { resolve } from 'node:path'

const { aot } = await import(
	Bun.resolveSync('elysia/plugin/aot/bun', resolve(import.meta.dir, '../../../packages/server'))
)

process.env.NODE_ENV = 'production'
process.env.ZC_PREVIEW_DATABASE_URL =
	'postgres://zc_preview:local-preview-only@127.0.0.1:5432/zc_rust_sqlx'

const root = resolve(import.meta.dir, '../../..')
const dependencies: Bun.BunPlugin = {
	name: 'existing-workspace-dependencies',
	setup(build) {
		build.onResolve({ filter: /^(elysia|drizzle-orm)(\/.*)?$/ }, ({ path }) => ({
			path: path.startsWith('elysia')
				? Bun.resolveSync(path, resolve(root, 'packages/server')).replace(/\.js$/, '.mjs')
				: Bun.resolveSync(path, resolve(root, 'packages/database')),
		}))
	},
}
Bun.plugin(dependencies)
const result = await Bun.build({
	entrypoints: [resolve(import.meta.dir, 'bun.ts')],
	minify: true,
	target: 'bun',
	plugins: [
		dependencies,
		aot(resolve(import.meta.dir, 'app.ts'), { target: 'bun', strip: false }),
	],
	compile: {
		target: 'bun-linux-x64',
		outfile: resolve(root, 'artifacts/rust-evaluation/benchmark/bun-server'),
		execArgv: ['--smol', '--no-env-file'],
	},
})
for (const log of result.logs) console.error(log)
if (!result.success) process.exit(1)
console.log('Compiled Linux Bun benchmark using existing workspace dependencies')
