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
			paintHolderDirectory: options.paintHolderDirectory as string,
			outputDirectory: bundleDirectory,
		})
		if (
			report.conflicts.length > 0 ||
			report.unresolvedReferences.length > 0 ||
			report.invalidControllers.length > 0 ||
			report.paintConflicts.length > 0 ||
			report.paintPhysicsErrors.length > 0
		) {
			throw new Error(
				`Block mesh export incomplete: ${report.conflicts.length} conflicts, ${report.unresolvedReferences.length} unresolved references, ${report.invalidControllers.length} invalid controllers, ${report.paintConflicts.length} paint conflicts, ${report.paintPhysicsErrors.length} paint physics errors.`,
			)
		}
	}
	const report = await compileProtectedBlockMeshCorpus({
		bundleDirectory,
		ghostModelDirectory: options.ghostModelDirectory,
		outputDirectory: options.outputDirectory,
	})
	console.log(
		`Generated protected corpus v3: ${report.blockCount} blocks, ${report.meshCount} meshes, ${report.triangleCount} triangles, ${report.negativeTransformPartCount} reflected parts, ${report.singularPartCount} singular parts omitted, ${report.encodedBytes} bytes.`,
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
	const paintHolderDirectory = values.get('--paint-holders')
	if (
		!bundleDirectory &&
		(!gameObjectDirectory || !assetMeshDirectory || !glbMeshDirectory || !paintHolderDirectory)
	) {
		throw new Error(usage())
	}
	return {
		bundleDirectory,
		gameObjectDirectory,
		assetMeshDirectory,
		glbMeshDirectory,
		paintHolderDirectory,
		ghostModelDirectory,
		outputDirectory,
	}
}

function usage() {
	return 'Usage: bun scripts/generate-block-mesh-manifest.ts (--bundle <v2-bundle> | --game-objects <v17_2/GameObject> --asset-meshes <v17_2/Mesh> --glb-meshes <v17_3/Mesh> --paint-holders <v17_2/MonoBehaviour>) --ghost-models <models> --out <private-corpus>'
}
