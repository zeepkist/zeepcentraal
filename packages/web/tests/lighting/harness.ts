import { MeshoptDecoder } from 'meshoptimizer/decoder'
import * as THREE from 'three'
import { composeProtectedMeshMatrix } from '../../app/utils/ghostLevelMeshRenderer.client'
import { type GhostLightingQuality, GhostLightingRig } from '../../app/utils/ghostLighting.client'
import { hideGhostLightingHelpers } from '../../app/utils/ghostLightingPasses.client'
import { createGhostNativeMaterial } from '../../app/utils/ghostNativeMaterial.client'
import { GhostPostprocessing } from '../../app/utils/ghostPostprocessing.client'
import { GhostVolumetricPass } from '../../app/utils/ghostVolumetrics.client'
import { parseProtectedLevelMeshBundle } from '../../app/utils/protectedMeshLibrary.client'
import { DEFAULT_GHOST_ENVIRONMENT, type GhostLightingData } from '../../shared/ghostLighting'

type FixtureOptions = {
	quality: GhostLightingQuality
	camera: 'orbit' | 'isometric'
	night?: boolean
	beams?: boolean
	pointBeams?: boolean
	occluder?: boolean
	level?: string
}
const element = document.querySelector('canvas')
if (!element) throw new Error('Lighting fixture canvas missing')
const canvas = element
let renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
renderer.setSize(640, 360)
renderer.setPixelRatio(1)
renderer.outputColorSpace = THREE.SRGBColorSpace
let scene: THREE.Scene,
	camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
	rig: GhostLightingRig,
	pipeline: GhostPostprocessing
let bounds = new THREE.Box3(),
	target = new THREE.Vector3(),
	timestamp = 0
const resources = new Set<THREE.BufferGeometry | THREE.Material>()

function material(
	color: [number, number, number],
	roughness = 0.7,
	transparent = false,
	emission?: [number, number, number],
) {
	const value = createGhostNativeMaterial({
		color,
		roughness,
		transparent,
		opacity: transparent ? 0.35 : 1,
		metalness: 0,
		specular: roughness < 0.1 ? [0.09, 0.52, 0.67] : [0.04, 0.04, 0.04],
		workflow: roughness < 0.1 ? 'specular' : 'metallic',
		doubleSided: false,
		...(emission ? { emissive: emission } : {}),
	})
	resources.add(value)
	return value
}
function mesh(geometry: THREE.BufferGeometry, finish: THREE.Material, position: number[]) {
	resources.add(geometry)
	resources.add(finish)
	const object = new THREE.Mesh(geometry, finish)
	object.position.fromArray(position)
	object.userData.reflectionSource = true
	object.userData.lightingGeometry = true
	object.castShadow = !finish.transparent
	object.receiveShadow = true
	scene.add(object)
	return object
}
function dispose() {
	pipeline?.dispose()
	rig?.dispose()
	for (const resource of resources) resource.dispose()
	resources.clear()
}
async function load(options: FixtureOptions) {
	dispose()
	scene = new THREE.Scene()
	const legacy = new THREE.Group()
	scene.add(legacy)
	let lighting: GhostLightingData = {
		environment: structuredClone(DEFAULT_GHOST_ENVIRONMENT),
		lights: [
			{
				id: 'red-spot',
				type: 'spot',
				position: [-5, 8, 4],
				direction: [0, -0.9, -0.43589],
				color: [1, 0.08, 0.025],
				intensity: 5,
				range: 20,
				angle: 0.55,
				penumbra: 0.2,
				volumetric: Boolean(options.beams),
			},
			{
				id: 'blue-point',
				type: 'point',
				position: [5, 3, -4],
				direction: [0, -1, 0],
				color: [0.05, 0.3, 1],
				intensity: 2,
				range: 15,
				angle: 0.7,
				penumbra: 0,
				volumetric: Boolean(options.beams) && options.pointBeams !== false,
			},
		],
	}
	if (options.level) {
		await MeshoptDecoder.ready
		const response = await fetch(`/fixture-level/${options.level}`)
		if (!response.ok) throw new Error(`Fixture unavailable: ${options.level}`)
		const bundle = parseProtectedLevelMeshBundle(new Uint8Array(await response.arrayBuffer()))
		if (!bundle.lighting) throw new Error('Lighting fixture requires corpus version 6')
		lighting = bundle.lighting
		for (const group of bundle.groups)
			for (const [index, primitive] of group.primitives.entries()) {
				resources.add(primitive.geometry)
				const descriptor = group.materials[index]
				const finish = descriptor
					? createGhostNativeMaterial(descriptor)
					: material([0.5, 0.5, 0.5])
				resources.add(finish)
				const object = new THREE.InstancedMesh(
					primitive.geometry,
					finish,
					group.matrices.length,
				)
				for (const [index, matrix] of group.matrices.entries())
					object.setMatrixAt(
						index,
						composeProtectedMeshMatrix(new THREE.Matrix4(), matrix, primitive),
					)
				object.instanceMatrix.needsUpdate = true
				object.userData.reflectionSource = true
				object.userData.lightingGeometry = true
				object.castShadow = !finish.transparent
				object.receiveShadow = true
				scene.add(object)
			}
	} else {
		mesh(new THREE.BoxGeometry(32, 1, 25), material([0.82, 0.82, 0.82]), [0, -0.5, 0])
		mesh(new THREE.BoxGeometry(3, 5, 3), material([1, 1, 1]), [-5, 2.5, 0])
		mesh(new THREE.BoxGeometry(4, 1, 9), material([0.35, 0.65, 0.9], 0.075), [0, 0.5, -3])
		mesh(new THREE.BoxGeometry(3, 5, 1), material([0.3, 0.65, 0.85], 0.1, true), [5, 2.5, 1])
		mesh(
			new THREE.BoxGeometry(1, 1, 1),
			material([0.8, 0.2, 0.04], 0.7, false, [4, 0.4, 0.02]),
			[-7, 7, 4],
		)
		if (options.occluder !== false)
			mesh(new THREE.BoxGeometry(8, 1, 6), material([0.7, 0.2, 0.1]), [-5, 4, 2])
		const ghost = mesh(
			new THREE.SphereGeometry(1),
			material([0.1, 0.75, 0.3], 0.6, true),
			[1, 2, 4],
		)
		ghost.name = 'ghost-model-fixture'
		ghost.userData.lightingGeometry = false
		ghost.castShadow = false
		scene.add(new THREE.GridHelper(30, 30))
		if (options.night) {
			lighting.environment.sun.intensity = 0.04
			lighting.environment.ambient = {
				top: [0.1, 0.16, 0.25],
				mid: [0.05, 0.07, 0.12],
				bottom: [0.01, 0.02, 0.04],
			}
			lighting.environment.sky = {
				top: [0.01, 0.025, 0.07],
				horizon: [0.04, 0.07, 0.12],
				bottom: [0.01, 0.02, 0.04],
				exposure: 1,
			}
			lighting.environment.fog.enabled = true
			lighting.environment.fog.color = [0.01, 0.02, 0.04]
		}
	}
	bounds.setFromObject(scene)
	target = bounds.getCenter(new THREE.Vector3())
	if (options.level) {
		const anchor = await (await fetch(`/fixture-camera/${options.level}`)).json()
		target.set(anchor.x, anchor.y + 4, -anchor.z)
	}
	const radius = options.level ? 48 : 24
	if (options.camera === 'isometric')
		camera = new THREE.OrthographicCamera(
			-radius,
			radius,
			(radius * 9) / 16,
			(-radius * 9) / 16,
			0.1,
			5000,
		)
	else camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 5000)
	camera.position.copy(target).add(new THREE.Vector3(radius * 0.9, radius * 0.65, radius * 1.15))
	camera.lookAt(target)
	camera.updateMatrixWorld()
	rig = new GhostLightingRig(renderer, scene, options.quality, legacy)
	rig.setLevel(lighting, { x: 0, y: 0, z: 0 })
	// Fix GTAO noise seed for reproducible captures; production scheduling remains unchanged.
	const random = Math.random
	let seed = 12345
	Math.random = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0
		return seed / 4294967296
	}
	try {
		pipeline = new GhostPostprocessing(renderer, scene, options.quality)
		render()
	} finally {
		Math.random = random
	}
}
function render() {
	rig.prepare(camera, target, bounds)
	pipeline.markDirty(true)
	timestamp += 1000
	pipeline.render(camera, target, timestamp, rig)
	const gl = renderer.getContext(),
		size = renderer.getDrawingBufferSize(new THREE.Vector2()),
		pixels = new Uint8Array(size.x * size.y * 4)
	gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
	let sum = 0,
		clipped = 0,
		nonBlack = 0
	for (let index = 0; index < pixels.length; index += 4) {
		const red = pixels[index] ?? 0,
			green = pixels[index + 1] ?? 0,
			blue = pixels[index + 2] ?? 0
		const maximum = Math.max(red, green, blue)
		sum += red + green + blue
		if (maximum >= 254) clipped++
		if (maximum > 5) nonBlack++
	}
	return {
		mean: sum / (size.x * size.y * 3),
		clipped: clipped / (size.x * size.y),
		nonBlack: nonBlack / (size.x * size.y),
		lights: rig.activeLightObjects.length,
		shadows: rig.activeLightObjects.reduce(
			(faces, light) =>
				faces + (light.castShadow ? (light instanceof THREE.PointLight ? 6 : 1) : 0),
			0,
		),
		exposure: renderer.toneMappingExposure,
		programs: renderer.info.programs?.length,
	}
}

function beamEnergy() {
	const depth = new THREE.WebGLRenderTarget(640, 360)
	depth.depthTexture = new THREE.DepthTexture(640, 360)
	const target = new THREE.WebGLRenderTarget(160, 90, { type: THREE.HalfFloatType })
	const volume = new GhostVolumetricPass(32)
	const depthMaterial = new THREE.MeshDepthMaterial()
	const restore = hideGhostLightingHelpers(scene)
	const previous = renderer.getRenderTarget(),
		background = scene.background,
		override = scene.overrideMaterial
	try {
		scene.background = null
		scene.overrideMaterial = depthMaterial
		renderer.setRenderTarget(depth)
		renderer.clear()
		renderer.render(scene, camera)
		volume.render(renderer, camera, depth.depthTexture, rig, target)
		const pixels = new Uint16Array(160 * 90 * 4)
		renderer.readRenderTargetPixels(target, 0, 0, 160, 90, pixels)
		let energy = 0
		for (let index = 0; index < pixels.length; index += 4)
			for (let channel = 0; channel < 3; channel++)
				energy += THREE.DataUtils.fromHalfFloat(pixels[index + channel] ?? 0)
		return energy / (160 * 90)
	} finally {
		scene.background = background
		scene.overrideMaterial = override
		restore()
		renderer.setRenderTarget(previous)
		volume.dispose()
		depthMaterial.dispose()
		depth.dispose()
		target.dispose()
	}
}

function resize(width: number, height: number) {
	renderer.setSize(width, height)
	if (camera instanceof THREE.PerspectiveCamera) camera.aspect = width / height
	camera.updateProjectionMatrix()
	return render()
}

async function replaceRenderer(options: FixtureOptions) {
	dispose()
	renderer.dispose()
	renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
	renderer.setSize(640, 360)
	renderer.outputColorSpace = THREE.SRGBColorSpace
	await load(options)
	return render()
}

async function restoreContext(options: FixtureOptions) {
	dispose()
	const extension = renderer.getContext().getExtension('WEBGL_lose_context')
	if (!extension) throw new Error('Context loss extension unavailable')
	const lost = new Promise<void>((resolve) =>
		canvas.addEventListener('webglcontextlost', () => resolve(), { once: true }),
	)
	extension.loseContext()
	await lost
	const restored = new Promise<void>((resolve) =>
		canvas.addEventListener('webglcontextrestored', () => resolve(), { once: true }),
	)
	// Restore after the loss event finishes dispatching, using the saved extension.
	await new Promise((resolve) => setTimeout(resolve, 0))
	extension.restoreContext()
	await restored
	await load(options)
	return render()
}

function physics() {
	pipeline.dispose()
	rig.dispose()
	return {
		shadows: renderer.shadowMap.enabled,
		toneMapping: renderer.toneMapping,
		groups: scene.getObjectByName('ghost-authored-lighting') !== undefined,
	}
}

Object.assign(window, {
	ghostLightingHarness: {
		load,
		render,
		beamEnergy,
		resize,
		replaceRenderer,
		restoreContext,
		physics,
		dispose,
	},
})

declare global {
	interface Window {
		ghostLightingHarness: {
			load: typeof load
			render: typeof render
			beamEnergy: typeof beamEnergy
			resize: typeof resize
			replaceRenderer: typeof replaceRenderer
			restoreContext: typeof restoreContext
			physics: typeof physics
			dispose: typeof dispose
		}
	}
}
