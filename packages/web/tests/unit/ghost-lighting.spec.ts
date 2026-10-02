import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { parseLevelGeometryBlocks } from '../../app/utils/ghostLevelGeometry'
import {
	GhostLightingRig,
	resolveGhostLightingQuality,
	selectGhostLights,
	selectGhostShadowLights,
} from '../../app/utils/ghostLighting.client'
import {
	hideGhostLightingHelpers,
	isOpaqueGhostGeometry,
} from '../../app/utils/ghostLightingPasses.client'
import { GhostReflectionRenderer } from '../../app/utils/ghostReflections.client'
import { extractUnityLights } from '../../scripts/unityLighting'
import { parseUnityMaterial } from '../../scripts/unityMaterials'
import { protectedMeshBundleCacheKey } from '../../server/utils/protectedMeshCorpus'
import {
	DEFAULT_GHOST_ENVIRONMENT,
	type GhostLight,
	type ProtectedLightDefinition,
	resolveGhostEnvironment,
	resolveGhostLights,
	validateGhostLightingData,
} from '../../shared/ghostLighting'

const definition = {
	type: 'spot',
	matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).toArray(),
	color: [1, 1, 1],
	intensity: 1,
	range: 50,
	angle: 90,
	innerAngle: 60,
	scale: true,
	volumetric: true,
	controller: {
		kind: 'custom',
		multiplier: 2,
		ignoreSkybox: true,
		alwaysOn: false,
		hue: 20,
		saturation: 1,
		brightness: 1,
		slots: { hue: 1, saturation: 3, brightness: 5, volumetric: 6, alwaysOn: 0 },
	},
} satisfies ProtectedLightDefinition
const block = {
	i: 2265,
	p: { x: 10, y: 20, z: 30 },
	r: { x: 0, y: 0, z: 0 },
	s: { x: -2, y: 2, z: 4 },
}
const light: GhostLight = {
	id: 'test',
	type: 'spot',
	position: [0, 0, 0],
	direction: [0, -1, 0],
	color: [1, 1, 1],
	range: 50,
	intensity: 1,
	angle: 0.7,
	penumbra: 0.2,
	volumetric: true,
}

describe('saved Ghost Explorer lighting', () => {
	it('keeps fractional JSON hue, saturation, brightness and volumetric toggle', () => {
		const blocks = parseLevelGeometryBlocks([
			{ ...block, d: { f: { cl1: 240, cl2: 0.5, cl3: 0.125 }, n: { cl4: 0 } } },
		])
		const resolved = resolveGhostLights(
			blocks,
			{ '2265': { lights: [definition] } },
			DEFAULT_GHOST_ENVIRONMENT,
		)[0]
		if (!resolved) throw new Error('Resolved light missing')
		expect(resolved.intensity).toBe(0.25)
		for (const [index, channel] of resolved.color.entries())
			expect(channel).toBeCloseTo([0.5, 0.5, 1][index] ?? 0)
		expect(resolved.volumetric).toBe(false)
		expect(resolved.position).toEqual([10, 20, -30])
		expect(resolved.direction[1]).toBeCloseTo(-1)
		expect(resolved.range).toBeCloseTo((50 * 8) / 3)
		// Nested spotlight rotation swaps Unity Y/Z scale axes.
		expect(resolved.angle).toBeCloseTo(THREE.MathUtils.degToRad(135) / 2)
	})
	it('keeps CSV options and matches disabled versus active lamps', () => {
		const csv = parseLevelGeometryBlocks([
			{ Id: 2265, Position: { X: 0, Y: 0, Z: 0 }, Options: [0, 120, 0, 1, 0, 0.375, 1] },
		])
		const custom = resolveGhostLights(
			csv,
			{ '2265': { lights: [definition] } },
			DEFAULT_GHOST_ENVIRONMENT,
		)[0]
		if (!custom) throw new Error('Resolved light missing')
		expect(custom.intensity).toBe(0.75)
		for (const [index, channel] of custom.color.entries())
			expect(channel).toBeCloseTo([0, 1, 0][index] ?? 0)
		expect(custom.volumetric).toBe(false)
		const lamp = {
			...definition,
			controller: {
				...definition.controller,
				kind: 'lamp' as const,
				ignoreSkybox: false,
				multiplier: 6,
				slots: { ...definition.controller.slots, alwaysOn: 2 },
			},
		}
		expect(
			resolveGhostLights(csv, { '2265': { lights: [lamp] } }, DEFAULT_GHOST_ENVIRONMENT),
		).toEqual([])
		const active = parseLevelGeometryBlocks([{ ...block, d: { n: { o2: 1 } } }])
		expect(
			resolveGhostLights(active, { '2265': { lights: [lamp] } }, DEFAULT_GHOST_ENVIRONMENT)[0]
				?.intensity,
		).toBe(6)
	})
	it('renders saved logic overrides without simulation and ignores hidden icons', () => {
		const logic = {
			...definition,
			controller: { ...definition.controller, kind: 'logic' as const },
		}
		const blocks = parseLevelGeometryBlocks([
			{
				...block,
				s: { x: 1, y: 1, z: 1 },
				d: { t: { oi2: '1200', oi3: '4500', oi4: '25' }, n: { is: 0, dv: 1, lbhd: 1 } },
			},
		])
		const resolved = resolveGhostLights(
			blocks,
			{ '2265': { lights: [logic] } },
			DEFAULT_GHOST_ENVIRONMENT,
		)[0]
		if (!resolved) throw new Error('Resolved light missing')
		expect(resolved).toMatchObject({
			type: 'point',
			range: 12,
			intensity: 0.25,
			volumetric: false,
		})
		expect(resolved.angle).toBeCloseTo(Math.PI / 8)
	})
	it('resolves built-in fallback and authored sun, fog, sky and volumetrics', () => {
		const profile = { ...DEFAULT_GHOST_ENVIRONMENT, lampBrightness: 0.5 }
		const fallback = resolveGhostEnvironment(null, 4, { '4': profile })
		expect(fallback.sun).toEqual(profile.sun)
		expect(fallback.lampBrightness).toBe(0.5)
		const resolved = resolveGhostEnvironment(
			{
				overrideFog_b: true,
				overrideFog_f: 0.02,
				skyboxOverride: {
					sun: { i: 0.125, c: { r: 0.2, g: 0.4, b: 1 }, sh: 0.6, _blt: true, blti: 0.5 },
					fog: { _fg: true },
					skybox: { s: 0, c1: { r: 0.1, g: 0.2, b: 0.3 } },
					volumetrics: { dn: 0.01, mie: 0.4, _c: true, c: { r: 1, g: 0, b: 0 } },
				},
			},
			4,
			{ '4': profile },
		)
		expect(resolved.sun).toMatchObject({ intensity: 0.125, color: [0.2, 0.4, 1], shadow: 0.6 })
		expect(resolved.fog).toMatchObject({ enabled: true, density: 0.02 })
		expect(resolved.sky.top).toEqual(resolved.sky.bottom)
		expect(resolved.volumetrics).toMatchObject({
			density: 0.01,
			anisotropy: 0.4,
			useCustomColor: true,
			color: [1, 0, 0],
		})
	})
	it('changes bundle cache identity for saved lighting and environment', () => {
		const blocks = parseLevelGeometryBlocks([block])
		const first = protectedMeshBundleCacheKey('fixture', blocks, { skybox: 1 }, 1)
		expect(protectedMeshBundleCacheKey('fixture', blocks, { skybox: 2 }, 1)).not.toBe(first)
		expect(protectedMeshBundleCacheKey('fixture', blocks, { skybox: 1 }, 2)).not.toBe(first)
		expect(
			protectedMeshBundleCacheKey(
				'fixture',
				parseLevelGeometryBlocks([{ ...block, d: { f: { cl3: 0.25 } } }]),
				{ skybox: 1 },
				1,
			),
		).not.toBe(first)
	})
	it('extracts active nested Unity light controllers and keeps icon hiding separate', () => {
		const documents = [
			{
				type: 108,
				id: '100',
				body: '  m_GameObject: {fileID: 1}\n  m_Type: 0\n  m_Enabled: 0\n  m_Intensity: 1\n  m_Range: 20\n  m_SpotAngle: 90',
			},
			{
				type: 114,
				id: '200',
				body: '  m_Script: {guid: brightness}\n  lamp: {fileID: 100}\n  originalRange: 50\n  originalAngle: 90\n  useScaling: 1\n  intensityMultiplier: 2',
			},
			{
				type: 114,
				id: '300',
				body: '  m_Script: {guid: custom}\n  brightnessScript: {fileID: 200}\n  brightness: 0.125',
			},
		]
		const lights = extractUnityLights(
			documents,
			new Map([
				['brightness', 'LampBrightness'],
				['custom', 'BlockEdit_CustomLight'],
			]),
			() => new THREE.Matrix4().makeTranslation(1, 2, 3),
			() => ({ visible: true, conditions: [{ kind: 'hideLogicBlock' }] }),
		)
		expect(lights[0]).toMatchObject({
			range: 50,
			scale: true,
			controller: { kind: 'custom', brightness: 0.125, multiplier: 2 },
		})
		expect(lights[0]?.visibility).toBeUndefined()
		expect(lights[0]?.matrix.slice(12, 15)).toEqual([1, 2, 3])
		expect(
			extractUnityLights(
				documents,
				new Map(),
				() => new THREE.Matrix4(),
				() => ({ visible: true, conditions: [] }),
			),
		).toEqual([])
	})
	it('allows authored HDR emission but ordinary white surfaces never emit', () => {
		expect(
			parseUnityMaterial('    - _Color: {r: 1, g: 1, b: 1, a: 1}', 'Standard').material
				.emissive,
		).toBeUndefined()
		expect(
			parseUnityMaterial(
				'    - _Color: {r: 1, g: 1, b: 1, a: 1}\n    - _EmissionColor: {r: 4, g: 4, b: 4, a: 1}',
				'Standard',
			).material.emissive,
		).toBeUndefined()
		expect(
			parseUnityMaterial(
				'  m_ShaderKeywords: _EMISSION\n    - _EmissionColor: {r: 4, g: 0.5, b: 0.02, a: 1}',
				'Standard',
			).material.emissive,
		).toEqual([4, 0.5, 0.02])
		expect(
			parseUnityMaterial(
				'  m_ValidKeywords:\n  - _EMISSION\n    - _EmissionColor: {r: 4, g: 0.5, b: 0.02, a: 1}',
				'Standard',
			).material.emissive,
		).toEqual([4, 0.5, 0.02])
		expect(
			parseUnityMaterial(
				'  m_ValidKeywords: []\n  m_InvalidKeywords:\n  - _EMISSION\n    - _EmissionColor: {r: 4, g: 4, b: 4, a: 1}',
				'Standard',
			).material.emissive,
		).toBeUndefined()
	})
	it('rejects malformed lighting trailers', () => {
		expect(() => validateGhostLightingData({ environment: {}, lights: [] })).toThrow(
			'Malformed ghost environment',
		)
		expect(() =>
			validateGhostLightingData({
				environment: DEFAULT_GHOST_ENVIRONMENT,
				lights: [{ ...light, range: 0 }],
			}),
		).toThrow('Malformed ghost light')
		expect(
			validateGhostLightingData({ environment: DEFAULT_GHOST_ENVIRONMENT, lights: [light] })
				.lights,
		).toHaveLength(1)
	})
})

describe('lighting budgets and lifecycle', () => {
	it.each(['performance', 'balanced', 'quality'] as const)(
		'selects %s light and shadow face budgets with hysteresis',
		(quality) => {
			const settings = resolveGhostLightingQuality(quality)
			const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500)
			camera.position.set(0, 20, 30)
			camera.lookAt(0, 0, 0)
			camera.updateMatrixWorld()
			const lights = Array.from({ length: 40 }, (_, index) => ({
				...light,
				id: String(index),
				type: index === 0 ? ('point' as const) : ('spot' as const),
				intensity: 40 - index,
			}))
			const selected = selectGhostLights(lights, camera, settings.localLights)
			expect(selected).toHaveLength(settings.localLights)
			const shadows = selectGhostShadowLights(selected, settings.shadowFaces)
			expect(
				selected.reduce(
					(faces, light) =>
						faces + (shadows.has(light.id) ? (light.type === 'point' ? 6 : 1) : 0),
					0,
				),
			).toBeLessThanOrEqual(settings.shadowFaces)
			expect(
				selectGhostLights(
					[
						{ ...light, id: 'old', intensity: 1 },
						{ ...light, id: 'new', intensity: 1.1 },
					],
					camera,
					1,
					new Set(['old']),
				)[0]?.id,
			).toBe('old')
		},
	)
	it('excludes glass, ghosts and helpers from depth/normal passes and restores visibility', () => {
		const scene = new THREE.Scene(),
			opaque = new THREE.Mesh(),
			glass = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ transparent: true })),
			ghost = new THREE.Mesh(),
			grid = new THREE.GridHelper()
		opaque.userData.lightingGeometry = true
		glass.userData.lightingGeometry = true
		scene.add(opaque, glass, ghost, grid)
		expect(isOpaqueGhostGeometry(opaque)).toBe(true)
		const restore = hideGhostLightingHelpers(scene)
		expect([opaque, glass, ghost, grid].map((object) => object.visible)).toEqual([
			true,
			false,
			false,
			false,
		])
		restore()
		expect([opaque, glass, ghost, grid].every((object) => object.visible)).toBe(true)
	})
	it('snaps sun shadows, caches idle shadows and restores physics settings on disposal', () => {
		const environment = new THREE.WebGLRenderTarget(1, 1)
		const generate = vi
			.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular')
			.mockReturnValue(environment)
		const disposeGenerator = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose')
		const renderer = {
			shadowMap: {
				enabled: false,
				type: THREE.PCFShadowMap,
				autoUpdate: true,
				needsUpdate: false,
			},
			toneMapping: THREE.NoToneMapping,
			toneMappingExposure: 1,
		} as THREE.WebGLRenderer
		const scene = new THREE.Scene(),
			legacy = new THREE.Group(),
			fog = new THREE.Fog(0, 1, 100)
		scene.fog = fog
		try {
			const rig = new GhostLightingRig(renderer, scene, 'balanced', legacy)
			rig.setLevel(undefined, { x: 0, y: 0, z: 0 })
			const camera = new THREE.PerspectiveCamera()
			camera.position.set(0, 20, 30)
			camera.lookAt(0, 0, 0)
			const bounds = new THREE.Box3(
				new THREE.Vector3(-1000, -1000, -1000),
				new THREE.Vector3(1000, 1000, 1000),
			)
			rig.prepare(camera, new THREE.Vector3(), bounds)
			const position = rig.sun.position.clone()
			renderer.shadowMap.needsUpdate = false
			rig.prepare(camera, new THREE.Vector3(0.00001, 0, 0), bounds)
			expect(rig.sun.position.distanceTo(position)).toBeLessThan(1e-8)
			expect(renderer.shadowMap.needsUpdate).toBe(false)
			const orthographic = new THREE.OrthographicCamera(-40, 40, 20, -20, 0.1, 1000)
			orthographic.position.copy(camera.position)
			orthographic.lookAt(0, 0, 0)
			rig.prepare(orthographic, new THREE.Vector3(), bounds)
			expect(scene.background).toBeInstanceOf(THREE.Color)
			rig.prepare(camera, new THREE.Vector3(), bounds)
			expect(scene.background).toBeInstanceOf(THREE.Texture)
			rig.dispose()
			rig.dispose()
			expect(scene.fog).toBe(fog)
			expect(legacy.visible).toBe(true)
			expect(renderer.shadowMap.enabled).toBe(false)
			expect(renderer.toneMapping).toBe(THREE.NoToneMapping)
			expect(disposeGenerator).toHaveBeenCalledOnce()
		} finally {
			generate.mockRestore()
			disposeGenerator.mockRestore()
		}
	})
	it('never samples previous reflection capture in later captures', () => {
		const scene = new THREE.Scene(),
			authored = new THREE.Texture(),
			sky = new THREE.Texture(),
			orthographicBackground = new THREE.Color(0.5, 0.6, 0.8),
			captured = new THREE.WebGLRenderTarget(1, 1)
		scene.environment = authored
		scene.background = sky
		const renderer = {
			getRenderTarget: () => null,
			setRenderTarget: vi.fn(),
			render: vi.fn(),
		} as unknown as THREE.WebGLRenderer
		const update = vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(() => {
			expect(scene.environment).toBe(authored)
			expect(scene.background).toBe(sky)
		})
		const generate = vi
			.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap')
			.mockReturnValue(captured)
		const disposeGenerator = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose')
		try {
			const reflection = new GhostReflectionRenderer(renderer, scene, 'performance')
			scene.background = orthographicBackground
			for (let index = 0; index < 5; index++) {
				reflection.markDirty(true)
				reflection.render(new THREE.PerspectiveCamera(), new THREE.Vector3(), index * 1000)
				expect(scene.background).toBe(orthographicBackground)
			}
			expect(update).toHaveBeenCalledTimes(5)
			reflection.dispose()
			expect(scene.environment).toBe(authored)
		} finally {
			update.mockRestore()
			generate.mockRestore()
			disposeGenerator.mockRestore()
		}
	})
})
