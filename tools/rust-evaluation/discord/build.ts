import { resolve } from 'node:path'

for (const name of ['bun', 'fixture', 'load', 'probe']) {
	const result = await Bun.build({
		entrypoints: [resolve(import.meta.dir, `${name}.ts`)],
		minify: true,
		target: 'bun',
		compile: {
			target: 'bun-linux-x64',
			outfile: resolve(import.meta.dir, `../../../artifacts/rust-evaluation/discord/${name}`),
			execArgv: ['--smol', '--no-env-file'],
		},
	})
	if (!result.success) {
		console.error(result.logs)
		process.exit(1)
	}
}
