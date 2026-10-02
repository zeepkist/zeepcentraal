import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GhostMaterialContributionPass } from '../../app/utils/ghostLightingPasses.client'
import {
	createGhostNativeMaterial,
	sortTransparentGhostInstances,
} from '../../app/utils/ghostNativeMaterial.client'
import {
	GhostReflectionClock,
	GhostReflectionRenderer,
	isGhostReflectionSource,
	resolveGhostReflectionQuality,
} from '../../app/utils/ghostReflections.client'
import { loadUnityMaterials, parseUnityMaterial } from '../../scripts/unityMaterials'

describe('authored materials', () => {
	it('resolves changed material and shader GUIDs through export metadata', async () => {
		const root = await mkdtemp(join(tmpdir(), 'unity-material-guid-'))
		const materials = join(root, 'Material'),
			shaders = join(root, 'Shader')
		await Promise.all([mkdir(materials), mkdir(shaders)])
		try {
			for (const guid of [
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
				'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
			]) {
				await Promise.all([
					writeFile(
						join(materials, 'Ice.mat.meta'),
						'guid: cccccccccccccccccccccccccccccccc\n',
					),
					writeFile(
						join(materials, 'Ice.mat'),
						`Material:\n  m_Shader: {fileID: 4800000, guid: ${guid}, type: 3}\n`,
					),
					writeFile(join(shaders, 'Ice.shader.meta'), `guid: ${guid}\n`),
					writeFile(
						join(shaders, 'Ice.shader'),
						'Shader "StandardSpecular" { Properties { _Glossiness("Smoothness", Range(0,1)) = 0.9 } }',
					),
				])
				const palette = await loadUnityMaterials(materials, shaders)
				expect(palette.materials.cccccccccccccccccccccccccccccccc?.roughness).toBeCloseTo(
					0.1,
				)
				expect(palette.unresolved).toEqual({})
			}
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
	it('uses authored roughness and legacy shininess when smoothness is absent', () => {
		expect(parseUnityMaterial('    - _Roughness: 0.2', 'Custom').material.roughness).toBe(0.2)
		expect(
			parseUnityMaterial('    - _Smoothness: 0.8', 'Custom').material.roughness,
		).toBeCloseTo(0.2)
		expect(
			parseUnityMaterial('    - _Shininess: 0.5', 'Legacy Specular').material.roughness,
		).toBeCloseTo((2 / 66) ** 0.25)
	})
	it('imports blue ice specular workflow and ignores metallic property', () => {
		const { material } = parseUnityMaterial(
			`
    - _Color: {r: 1, g: 1, b: 1, a: 1}
    - _SpecColor: {r: 0.09, g: 0.52, b: 0.67, a: 1}
    - _Glossiness: 0.925
    - _Metallic: 0.5
    - _Mode: 0`,
			'UVFree/StandardSpecular/Single-Texture',
		)
		expect(material).toMatchObject({
			color: [1, 1, 1],
			specular: [0.09, 0.52, 0.67],
			metalness: 0,
			workflow: 'specular',
		})
		expect(material.roughness).toBeCloseTo(0.075)
		const native = createGhostNativeMaterial(material)
		const shader = {
			uniforms: {},
			fragmentShader: '#include <lights_physical_fragment>',
		} as unknown as THREE.WebGLProgramParametersWithUniforms
		native.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
		expect(shader.fragmentShader).toContain('material.specularColor = unitySpecular')
		expect(shader.uniforms.unitySpecular?.value.b).toBeCloseTo(
			new THREE.Color().setRGB(0.09, 0.52, 0.67, THREE.SRGBColorSpace).b,
		)
		native.dispose()
	})

	it('uses glass alpha and shininess without opaque depth writes', () => {
		const { material } = parseUnityMaterial(
			`
    - _Color: {r: 0.2, g: 0.3, b: 0.75, a: 0.5}
    - _Glossiness: 0.943
    - _Metallic: 0
    - _Mode: 3`,
			'UVFree/StandardMetallic',
		)
		const native = createGhostNativeMaterial(material)
		expect(native.opacity).toBe(0.5)
		expect(native.transparent).toBe(true)
		expect(native.depthWrite).toBe(false)
		expect(native.roughness).toBeCloseTo(0.057)
		expect(native.color.getHexString()).toBe(
			new THREE.Color().setRGB(0.2, 0.3, 0.75, THREE.SRGBColorSpace).getHexString(),
		)
		native.dispose()
	})

	it('uses shader defaults and reports only properties absent from both sources', () => {
		const parsed = parseUnityMaterial(
			'',
			'StandardSpecular',
			`
_Color("Color", Color) = (0.2,0.4,0.6,1)
_SpecColor("Specular", Color) = (0.1,0.2,0.3,1)
_Glossiness("Smoothness", Range(0, 1)) = 0.8
_Mode("Mode", Float) = 0`,
		)
		expect(parsed.defaults).toEqual([])
		expect(parsed.material.color).toEqual([0.2, 0.4, 0.6])
		expect(parsed.material.roughness).toBeCloseTo(0.2)
		expect(parseUnityMaterial('', 'Unlit/FrostedGlass').defaults).toContain('_Color')
		expect(parseUnityMaterial('', 'Unlit/FrostedGlass').material.opacity).toBe(0.5)
		expect(() => parseUnityMaterial('    - _Glossiness: NaN', 'Standard')).toThrow(
			'Malformed protected material descriptor',
		)
	})

	it('sorts transparent instances back to front from current camera', () => {
		const geometry = new THREE.BoxGeometry()
		const material = new THREE.MeshPhysicalMaterial({ transparent: true })
		const mesh = new THREE.InstancedMesh(geometry, material, 2)
		const camera = new THREE.PerspectiveCamera()
		camera.updateMatrixWorld()
		const near = new THREE.Matrix4().makeTranslation(0, 0, -2)
		const far = new THREE.Matrix4().makeTranslation(0, 0, -20)
		sortTransparentGhostInstances(mesh, [near, far], camera)
		const first = new THREE.Matrix4()
		mesh.getMatrixAt(0, first)
		expect(first.elements[14]).toBe(-20)
		mesh.dispose()
		geometry.dispose()
		material.dispose()
	})
})

describe('reflection scheduling and sources', () => {
	it('restores helpers after failed capture and disposes owned resources once', () => {
		const scene = new THREE.Scene()
		const grid = new THREE.GridHelper()
		const soapbox = new THREE.Mesh()
		soapbox.name = 'ghost-model-body'
		scene.add(grid, soapbox)
		const originalEnvironment = new THREE.Texture()
		scene.environment = originalEnvironment
		const target = new THREE.WebGLRenderTarget(1, 1)
		const environment = new THREE.WebGLRenderTarget(1, 1)
		const disposeEnvironment = vi.spyOn(environment, 'dispose')
		const renderer = {
			getRenderTarget: () => target,
			getDrawingBufferSize: (size: THREE.Vector2) => size.set(8, 8),
			setRenderTarget: vi.fn(),
			render: vi.fn(),
		} as unknown as THREE.WebGLRenderer
		const specular = vi
			.spyOn(GhostMaterialContributionPass.prototype, 'render')
			.mockImplementation(() => {})
		const update = vi.spyOn(THREE.CubeCamera.prototype, 'update').mockImplementation(() => {
			expect(grid.visible).toBe(false)
			expect(soapbox.visible).toBe(true)
			throw new Error('Lost context')
		})
		const generate = vi
			.spyOn(THREE.PMREMGenerator.prototype, 'fromCubemap')
			.mockReturnValue(environment)
		const disposeGenerator = vi.spyOn(THREE.PMREMGenerator.prototype, 'dispose')
		try {
			const reflections = new GhostReflectionRenderer(renderer, scene, 'performance')
			expect(() =>
				reflections.render(new THREE.PerspectiveCamera(), new THREE.Vector3(), 0),
			).toThrow('Lost context')
			expect(grid.visible).toBe(true)
			expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(target)
			update.mockImplementation(() => undefined)
			reflections.render(new THREE.PerspectiveCamera(), new THREE.Vector3(), 1)
			expect(scene.environment).toBe(originalEnvironment)
			reflections.dispose()
			reflections.dispose()
			expect(scene.environment).toBe(originalEnvironment)
			expect(disposeEnvironment).toHaveBeenCalledOnce()
			expect(disposeGenerator).toHaveBeenCalledOnce()
		} finally {
			update.mockRestore()
			specular.mockRestore()
			generate.mockRestore()
			disposeGenerator.mockRestore()
		}
	})
	it('follows all three render quality budgets', () => {
		expect(resolveGhostReflectionQuality('quality')).toEqual({
			resolutionScale: 1,
			cubeSize: 1024,
			interval: 100,
		})
		expect(resolveGhostReflectionQuality('balanced')).toEqual({
			resolutionScale: 0.5,
			cubeSize: 512,
			interval: 200,
		})
		expect(resolveGhostReflectionQuality('performance')).toEqual({
			resolutionScale: 0,
			cubeSize: 128,
			interval: 500,
		})
	})
	it('captures dirty changes within budget, forces scrubs, and stays idle when clean', () => {
		const clock = new GhostReflectionClock()
		expect(clock.due(0, 100)).toBe(true)
		clock.commit(0)
		expect(clock.due(5000, 100)).toBe(false)
		clock.mark()
		expect(clock.due(50, 100)).toBe(false)
		expect(clock.due(100, 100)).toBe(true)
		clock.commit(100)
		clock.mark(true)
		expect(clock.due(101, 100)).toBe(true)
	})
	it('includes terrain and soapboxes, excludes grid and fallback markers', () => {
		const mesh = new THREE.Mesh()
		mesh.name = 'ghost-model-body'
		expect(isGhostReflectionSource(mesh)).toBe(true)
		mesh.name = 'ghost-marker'
		expect(isGhostReflectionSource(mesh)).toBe(false)
		mesh.userData.reflectionSource = true
		expect(isGhostReflectionSource(mesh)).toBe(true)
		expect(isGhostReflectionSource(new THREE.GridHelper())).toBe(false)
	})
})
