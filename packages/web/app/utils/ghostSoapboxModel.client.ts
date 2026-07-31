import type * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GHOST_SOAPBOX_AXLE_POSITIONS } from '~/utils/ghostSoapbox'

export type GhostSoapboxGeometries = {
	axles: THREE.BufferGeometry
	body: THREE.BufferGeometry
	character: THREE.BufferGeometry
	wheel: THREE.BufferGeometry
}

const MODEL_URLS = {
	axle: new URL('../assets/models/axle.stl', import.meta.url).href,
	character: new URL('../assets/models/character.stl', import.meta.url).href,
	soapbox: new URL('../assets/models/soapbox.stl', import.meta.url).href,
	spoiler: new URL('../assets/models/spoiler.stl', import.meta.url).href,
	wheel: new URL('../assets/models/wheel.stl', import.meta.url).href,
} as const

const MODEL_ROTATION_X = -Math.PI / 2
const SPOILER_OFFSET_Y = -1.0146778822

let geometryPromise: Promise<GhostSoapboxGeometries> | null = null

export function loadGhostSoapboxGeometries(): Promise<GhostSoapboxGeometries> {
	geometryPromise ??= loadGeometries()
	return geometryPromise
}

async function loadGeometries(): Promise<GhostSoapboxGeometries> {
	const loader = new STLLoader()
	const [axle, character, soapbox, spoiler, wheel] = await Promise.all([
		loader.loadAsync(MODEL_URLS.axle),
		loader.loadAsync(MODEL_URLS.character),
		loader.loadAsync(MODEL_URLS.soapbox),
		loader.loadAsync(MODEL_URLS.spoiler),
		loader.loadAsync(MODEL_URLS.wheel),
	])

	for (const geometry of [axle, character, soapbox, spoiler, wheel]) {
		geometry.rotateX(MODEL_ROTATION_X)
	}
	axle.center()
	wheel.center()
	spoiler.translate(0, SPOILER_OFFSET_Y, 0)
	const body = mergeOrThrow([soapbox, spoiler])
	const axleParts = GHOST_SOAPBOX_AXLE_POSITIONS.map((position) => {
		const geometry = axle.clone()
		geometry.translate(...position)
		return geometry
	})
	const axles = mergeOrThrow(axleParts)
	for (const geometry of [axle, ...axleParts, soapbox, spoiler]) geometry.dispose()
	for (const geometry of [axles, body, character, wheel]) {
		geometry.computeBoundingSphere()
	}

	return { axles, body, character, wheel }
}

function mergeOrThrow(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeGeometries(geometries)
	if (!merged) throw new Error('Could not merge ghost soapbox geometries')
	return merged
}
