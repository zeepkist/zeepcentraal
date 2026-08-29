import { resolve } from 'node:path'

const result = await Bun.build({
	entrypoints: [resolve(import.meta.dir, '../runtime/telemetryBootstrap.ts')],
	outdir: resolve(import.meta.dir, '../.output/server'),
	naming: 'telemetry.mjs',
	target: 'bun',
	format: 'esm',
	minify: true,
})

for (const log of result.logs) console.error(log)
if (!result.success) process.exit(1)
