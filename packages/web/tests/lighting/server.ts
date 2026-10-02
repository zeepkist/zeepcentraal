import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseLevel } from '@zeepkist/core/levels'
import { parseLevelGeometryBlocks } from '../../app/utils/ghostLevelGeometry'
import { buildProtectedLevelMeshBundle } from '../../server/utils/protectedMeshCorpus'

const root = join(import.meta.dir, '../../../../.data/ghost-lighting-browser')
await mkdir(root, { recursive: true })
const build = await Bun.build({
	entrypoints: [join(import.meta.dir, 'harness.ts')],
	target: 'browser',
	outdir: root,
})
if (!build.success) throw new Error(build.logs.join('\n'))
const names: Record<string, string> = {
	'airborne-embers': 'zsl-airborne-embers.zeeplevel',
	'a-colourful-valley': 'zsl-2026-02-a-colorful-valley.zeeplevel',
	aerotaro: 'zsl-2026-02-aerotaro.zeeplevel',
}
const fixtures =
	process.env.GHOST_LIGHTING_FIXTURES_DIR ??
	join(import.meta.dir, '../../../core/testdata/legacy-hash')
const corpus =
	process.env.GHOST_LIGHTING_CORPUS ??
	'X:/GitHub/zeepcentraal/zeepcentraal-meshes/block-meshes-v6'
Bun.serve({
	hostname: '127.0.0.1',
	port: 4185,
	async fetch(request) {
		const path = new URL(request.url).pathname
		if (path === '/harness.js')
			return new Response(Bun.file(join(root, 'harness.js')), {
				headers: { 'Content-Type': 'text/javascript' },
			})
		if (path === '/fixtures') return Response.json(Object.keys(names))
		if (path.startsWith('/fixture-camera/')) {
			const name = path.slice('/fixture-camera/'.length)
			if (!names[name]) return new Response('Unknown fixture', { status: 404 })
			const source = await readFile(join(fixtures, names[name]), 'utf8')
			const blocks = parseLevelGeometryBlocks(parseLevel(source).blocks)
			// Review nearby track geometry, rather than distant decorative objects or outliers.
			const anchor =
				blocks.find((block) => [1, 1363, 2256, 2259].includes(block.id ?? -1)) ?? blocks[0]
			return Response.json(anchor?.position ?? { x: 0, y: 0, z: 0 })
		}
		if (path.startsWith('/fixture-level/') && fixtures) {
			const name = path.slice('/fixture-level/'.length)
			if (!names[name]) return new Response('Unknown fixture', { status: 404 })
			const source = await readFile(join(fixtures, names[name]), 'utf8')
			const parsed = parseLevel(source)
			return new Response(
				await buildProtectedLevelMeshBundle(
					corpus,
					parseLevelGeometryBlocks(parsed.blocks),
					'',
					parsed.environment,
					parsed.typeSkybox,
				),
			)
		}
		return new Response(
			'<!doctype html><html><body style="margin:0;background:#111"><canvas></canvas><script type="module" src="/harness.js"></script></body></html>',
			{ headers: { 'Content-Type': 'text/html' } },
		)
	},
})
