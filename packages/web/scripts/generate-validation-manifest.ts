import { generateValidationManifest } from './validationManifest'

const [
	gameObjectDirectory,
	scriptDirectory,
	assetMeshDirectory,
	glbMeshDirectory,
	gameVersion,
	output,
] = process.argv.slice(2)
if (
	!gameObjectDirectory ||
	!scriptDirectory ||
	!assetMeshDirectory ||
	!glbMeshDirectory ||
	!gameVersion ||
	!output
)
	throw new Error(
		'Usage: generate-validation-manifest.ts <GameObject> <Scripts> <Mesh assets> <GLB meshes> <game version> <private output.json>',
	)
const manifest = await generateValidationManifest({
	gameObjectDirectory,
	scriptDirectory,
	assetMeshDirectory,
	glbMeshDirectory,
	gameVersion,
	output,
})
console.log(
	`Exported ${Object.keys(manifest.blocks).length} validation blocks; calibration disabled`,
)
