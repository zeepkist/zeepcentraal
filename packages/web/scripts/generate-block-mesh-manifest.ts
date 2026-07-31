import { generateBlockMeshBundle } from './blockMeshManifest'

const options = parseArguments(process.argv.slice(2))
const { report } = await generateBlockMeshBundle(options)

console.log(
	`Generated ${report.blockCount} blocks, ${report.partCount} parts, ${report.meshCount} shared meshes.`,
)
if (report.conflicts.length > 0 || report.unresolvedReferences.length > 0) {
	throw new Error(
		`Block mesh export incomplete: ${report.conflicts.length} conflicts, ${report.unresolvedReferences.length} unresolved references. See report.json.`,
	)
}

function parseArguments(args: string[]) {
	const values = new Map<string, string>()
	let copyMeshes = true
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]
		if (argument === '--no-copy') {
			copyMeshes = false
			continue
		}
		if (!argument?.startsWith('--')) continue
		const value = args[index + 1]
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
		values.set(argument, value)
		index += 1
	}
	const required = ['--game-objects', '--asset-meshes', '--glb-meshes', '--out'] as const
	for (const key of required) {
		if (!values.has(key)) {
			throw new Error(
				'Usage: bun scripts/generate-block-mesh-manifest.ts --game-objects <v17_2/GameObject> --asset-meshes <v17_2/Mesh> --glb-meshes <v17_3/Mesh> --out <directory> [--no-copy]',
			)
		}
	}
	return {
		gameObjectDirectory: values.get('--game-objects') as string,
		assetMeshDirectory: values.get('--asset-meshes') as string,
		glbMeshDirectory: values.get('--glb-meshes') as string,
		outputDirectory: values.get('--out') as string,
		copyMeshes,
	}
}
