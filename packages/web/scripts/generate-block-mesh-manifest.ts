import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateBlockMeshBundle } from './blockMeshManifest'
import { compileProtectedBlockMeshCorpus } from './protectedBlockMeshCorpus'

const options = parseArguments(process.argv.slice(2))
let bundleDirectory = options.bundleDirectory
let temporaryDirectory: string | null = null

try {
	if (!bundleDirectory) {
		temporaryDirectory = await mkdtemp(join(tmpdir(), 'zeepcentraal-block-meshes-'))
		bundleDirectory = temporaryDirectory
		const { report } = await generateBlockMeshBundle({
			gameObjectDirectory: options.gameObjectDirectory as string,
			assetMeshDirectory: options.assetMeshDirectory as string,
			glbMeshDirectory: options.glbMeshDirectory as string,
			outputDirectory: bundleDirectory,
		})
		if (report.conflicts.length > 0 || report.unresolvedReferences.length > 0) {
			throw new Error(
				`Block mesh export incomplete: ${report.conflicts.length} conflicts, ${report.unresolvedReferences.length} unresolved references.`,
			)
		}
	}
	const report = await compileProtectedBlockMeshCorpus({
		bundleDirectory,
		ghostModelDirectory: options.ghostModelDirectory,
		outputDirectory: options.outputDirectory,
	})
	console.log(
		`Generated protected corpus: ${report.blockCount} blocks, ${report.meshCount} meshes, ${report.triangleCount} triangles, ${report.encodedBytes} bytes.`,
	)
} finally {
	if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
}

function parseArguments(args: string[]) {
	const values = new Map<string, string>()
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]
		if (!argument?.startsWith('--')) continue
		const value = args[index + 1]
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
		values.set(argument, value)
		index += 1
	}
	const outputDirectory = values.get('--out')
	const ghostModelDirectory = values.get('--ghost-models')
	if (!outputDirectory || !ghostModelDirectory) throw new Error(usage())
	const bundleDirectory = values.get('--bundle')
	const gameObjectDirectory = values.get('--game-objects')
	const assetMeshDirectory = values.get('--asset-meshes')
	const glbMeshDirectory = values.get('--glb-meshes')
	if (!bundleDirectory && (!gameObjectDirectory || !assetMeshDirectory || !glbMeshDirectory)) {
		throw new Error(usage())
	}
	return {
		bundleDirectory,
		gameObjectDirectory,
		assetMeshDirectory,
		glbMeshDirectory,
		ghostModelDirectory,
		outputDirectory,
	}
}

function usage() {
	return 'Usage: bun scripts/generate-block-mesh-manifest.ts (--bundle <existing-bundle> | --game-objects <v17_2/GameObject> --asset-meshes <v17_2/Mesh> --glb-meshes <v17_3/Mesh>) --ghost-models <models> --out <private-corpus>'
}
