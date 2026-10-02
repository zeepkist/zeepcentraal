import * as THREE from 'three'
import {
	DEFAULT_GHOST_ENVIRONMENT,
	type GhostLight,
	type GhostLightingData,
	type LightingColor,
} from '../../shared/ghostLighting'
import type { GhostVector3 } from '../types/ghost'

export type GhostLightingQuality = 'performance' | 'balanced' | 'quality'
export function resolveGhostLightingQuality(quality: GhostLightingQuality) {
	return quality === 'quality'
		? {
				localLights: 32,
				sunSize: 4096,
				shadowFaces: 8,
				aoScale: 1,
				effectScale: 0.5,
				beamSteps: 32,
			}
		: quality === 'balanced'
			? {
					localLights: 16,
					sunSize: 2048,
					shadowFaces: 2,
					aoScale: 0.5,
					effectScale: 0.25,
					beamSteps: 16,
				}
			: {
					localLights: 8,
					sunSize: 1024,
					shadowFaces: 0,
					aoScale: 0,
					effectScale: 0,
					beamSteps: 0,
				}
}

export function selectGhostLights(
	lights: readonly GhostLight[],
	camera: THREE.Camera,
	maximum: number,
	previous: ReadonlySet<string> = new Set(),
) {
	const frustum = new THREE.Frustum().setFromProjectionMatrix(
		new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
	)
	const position = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
	return lights
		.map((light) => {
			const center = new THREE.Vector3(...light.position)
			const visible = frustum.intersectsSphere(new THREE.Sphere(center, light.range))
			const distance = center.distanceTo(position)
			// Unity lamps use range-relative attenuation, rather than SI candela.
			const score = visible
				? ((light.intensity * Math.max(...light.color)) /
						(1 + (25 * distance ** 2) / light.range ** 2)) *
					(previous.has(light.id) ? 1.2 : 1)
				: 0
			return { light, score }
		})
		.filter((entry) => entry.score > 0)
		.sort(
			(left, right) =>
				right.score - left.score || left.light.id.localeCompare(right.light.id),
		)
		.slice(0, maximum)
		.map((entry) => entry.light)
}

export function selectGhostShadowLights(lights: readonly GhostLight[], faces: number) {
	const selected = new Set<string>()
	let remaining = faces
	for (const light of lights) {
		const cost = light.type === 'point' ? 6 : 1
		if (cost > remaining) continue
		selected.add(light.id)
		remaining -= cost
	}
	return selected
}

const linearColor = (color: LightingColor) =>
	new THREE.Color().setRGB(...color, THREE.SRGBColorSpace)

function skyColor(
	elevation: number,
	top: LightingColor,
	middle: LightingColor,
	bottom: LightingColor,
	exposure: number,
	upper?: LightingColor,
) {
	const from = linearColor(middle),
		to = linearColor(elevation < 0 ? bottom : top)
	return (
		elevation > 0 && upper
			? elevation < 0.5
				? from.lerp(linearColor(upper), elevation * 2)
				: linearColor(upper).lerp(to, elevation * 2 - 1)
			: from.lerp(to, Math.abs(elevation))
	).multiplyScalar(exposure)
}

/** Small analytic HDR environment; no external sky assets or network requests. */
export function createGhostSkyTexture(
	top: LightingColor,
	middle: LightingColor,
	bottom: LightingColor,
	exposure = 1,
	upper?: LightingColor,
) {
	const width = 64,
		height = 32,
		data = new Float32Array(width * height * 4)
	for (let y = 0; y < height; y += 1) {
		const elevation = Math.sin((y / (height - 1) - 0.5) * Math.PI)
		const color = skyColor(elevation, top, middle, bottom, exposure, upper)
		for (let x = 0; x < width; x += 1)
			data.set([color.r, color.g, color.b, 1], (y * width + x) * 4)
	}
	const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
	texture.mapping = THREE.EquirectangularReflectionMapping
	texture.colorSpace = THREE.LinearSRGBColorSpace
	texture.minFilter = THREE.LinearFilter
	texture.magFilter = THREE.LinearFilter
	texture.needsUpdate = true
	return texture
}

export class GhostLightingRig {
	readonly group = new THREE.Group()
	readonly sun = new THREE.DirectionalLight()
	private readonly backlight = new THREE.DirectionalLight()
	private readonly lights = new Map<string, THREE.PointLight | THREE.SpotLight>()
	private selected = new Set<string>()
	private activeLights: GhostLight[] = []
	private data: GhostLightingData = { environment: DEFAULT_GHOST_ENVIRONMENT, lights: [] }
	private readonly settings
	private readonly previousBackground
	private readonly previousEnvironment
	private readonly previousFog
	private readonly previousEnvironmentIntensity
	private environment: THREE.WebGLRenderTarget | null = null
	private sky: THREE.DataTexture | null = null
	private generator: THREE.PMREMGenerator
	private readonly coverage = new THREE.Box3()
	private disposed = false

	constructor(
		private readonly renderer: THREE.WebGLRenderer,
		private readonly scene: THREE.Scene,
		quality: GhostLightingQuality,
		private readonly legacyLights: THREE.Group,
	) {
		this.settings = resolveGhostLightingQuality(quality)
		this.previousBackground = scene.background
		this.previousEnvironment = scene.environment
		this.previousEnvironmentIntensity = scene.environmentIntensity
		this.previousFog = scene.fog
		this.generator = new THREE.PMREMGenerator(renderer)
		this.group.name = 'ghost-authored-lighting'
		this.sun.castShadow = true
		this.sun.shadow.mapSize.set(this.settings.sunSize, this.settings.sunSize)
		this.sun.shadow.normalBias = 0.04
		this.sun.shadow.bias = -0.0001
		this.sun.shadow.camera.near = 0.1
		this.sun.shadow.camera.far = 1200
		this.group.add(this.sun, this.sun.target, this.backlight, this.backlight.target)
		this.scene.add(this.group)
		legacyLights.visible = false
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = THREE.PCFShadowMap
		renderer.shadowMap.autoUpdate = false
		renderer.toneMapping = THREE.AgXToneMapping
		renderer.toneMappingExposure = 1
	}

	setLevel(data: GhostLightingData | undefined, origin: GhostVector3) {
		this.clearLights()
		const source = data ?? { environment: DEFAULT_GHOST_ENVIRONMENT, lights: [] }
		this.data = {
			environment: source.environment,
			lights: source.lights.map((light) => ({
				...light,
				position: [
					light.position[0] - origin.x,
					light.position[1] - origin.y,
					light.position[2] + origin.z,
				],
			})),
		}
		const profile = this.data.environment
		this.sun.color.copy(linearColor(profile.sun.color))
		this.sun.intensity = profile.sun.intensity * Math.PI
		this.sun.castShadow = profile.sun.shadow > 0 && profile.sun.intensity > 0
		this.sun.shadow.intensity = profile.sun.shadow
		this.backlight.color.copy(linearColor(profile.backlight.color))
		this.backlight.intensity = profile.backlight.intensity * Math.PI
		this.backlight.position.fromArray(profile.backlight.direction).multiplyScalar(-100)
		this.environment?.dispose()
		this.sky?.dispose()
		this.sky = createGhostSkyTexture(
			profile.sky.top,
			profile.sky.horizon,
			profile.sky.bottom,
			profile.sky.exposure,
			profile.sky.upper,
		)
		const ambient = createGhostSkyTexture(
			profile.ambient.top,
			profile.ambient.mid,
			profile.ambient.bottom,
		)
		this.environment = this.generator.fromEquirectangular(ambient)
		ambient.dispose()
		this.scene.environment = this.environment.texture
		this.scene.environmentIntensity = 1
		this.scene.background = this.sky
		this.scene.fog = profile.fog.enabled
			? new THREE.FogExp2(linearColor(profile.fog.color), profile.fog.density)
			: null
		this.coverage.makeEmpty()
		this.markDirty()
	}

	get volumetricLights() {
		return this.activeLights.filter((light) => light.volumetric)
	}
	get environmentSettings() {
		return this.data.environment
	}
	get activeLightObjects() {
		return this.activeLights.flatMap((light) => {
			const object = this.lights.get(light.id)
			return object ? [object] : []
		})
	}
	getLightObject(id: string) {
		return this.lights.get(id)
	}
	get baseEnvironment() {
		return this.environment?.texture ?? this.previousEnvironment
	}
	markDirty() {
		this.renderer.shadowMap.needsUpdate = true
	}

	prepare(camera: THREE.Camera, target: THREE.Vector3, bounds: THREE.Box3) {
		camera.updateMatrixWorld()
		if (camera instanceof THREE.OrthographicCamera) {
			// Parallel rays sample one sky direction. Three's unit background cube cannot fill an orthographic viewport.
			const profile = this.data.environment.sky
			this.scene.background = skyColor(
				camera.getWorldDirection(new THREE.Vector3()).y,
				profile.top,
				profile.horizon,
				profile.bottom,
				profile.exposure,
				profile.upper,
			)
		} else this.scene.background = this.sky
		const active = selectGhostLights(
			this.data.lights,
			camera,
			this.settings.localLights,
			this.selected,
		)
		const shadows = selectGhostShadowLights(active, this.settings.shadowFaces)
		const next = new Set(active.map((light) => light.id))
		for (const [id, object] of this.lights) {
			if (next.has(id)) continue
			this.group.remove(object)
			if (object instanceof THREE.SpotLight) this.group.remove(object.target)
			object.shadow.dispose()
			this.lights.delete(id)
			this.markDirty()
		}
		for (const light of active) {
			let object = this.lights.get(light.id)
			if (!object) {
				object = light.type === 'spot' ? new THREE.SpotLight() : new THREE.PointLight()
				object.position.fromArray(light.position)
				object.color.copy(linearColor(light.color))
				object.intensity = light.intensity * Math.PI
				// Unity's legacy range attenuation. Decay zero avoids inverse-square unit mismatch.
				object.decay = 0
				object.distance = light.range
				if (object instanceof THREE.SpotLight) {
					object.angle = light.angle
					object.penumbra = light.penumbra
					object.target.position
						.copy(object.position)
						.add(new THREE.Vector3(...light.direction))
					this.group.add(object.target)
				}
				object.shadow.mapSize.set(1024, 1024)
				object.shadow.camera.near = Math.max(0.05, light.range / 10_000)
				object.shadow.camera.far = light.range
				object.shadow.normalBias = 0.02
				object.shadow.bias = -0.0001
				this.lights.set(light.id, object)
				this.group.add(object)
				this.markDirty()
			}
			if (object.castShadow !== shadows.has(light.id)) this.markDirty()
			object.castShadow = shadows.has(light.id)
		}
		this.selected = next
		this.activeLights = active
		this.fitSun(camera, target, bounds)
	}

	private fitSun(camera: THREE.Camera, target: THREE.Vector3, bounds: THREE.Box3) {
		const orthographic = camera instanceof THREE.OrthographicCamera
		const radius = orthographic
			? Math.min(500, Math.max(40, (camera.top - camera.bottom) / camera.zoom))
			: 180
		const box = new THREE.Box3(
			target.clone().addScalar(-radius),
			target.clone().addScalar(radius),
		)
		if (!bounds.isEmpty()) box.intersect(bounds)
		if (box.isEmpty()) return
		const center = box.getCenter(new THREE.Vector3())
		const extent =
			Math.ceil(Math.max(20, box.getSize(new THREE.Vector3()).length() / 2) / 10) * 10
		const direction = new THREE.Vector3(...this.data.environment.sun.direction).normalize()
		const basis = new THREE.Matrix4().lookAt(
			direction.clone().negate(),
			new THREE.Vector3(),
			new THREE.Vector3(0, 1, 0),
		)
		const lightCenter = center.clone().applyMatrix4(basis.clone().invert())
		const texel = (2 * extent) / this.settings.sunSize
		lightCenter.x = Math.round(lightCenter.x / texel) * texel
		lightCenter.y = Math.round(lightCenter.y / texel) * texel
		lightCenter.z = Math.round(lightCenter.z / texel) * texel
		center.copy(lightCenter.applyMatrix4(basis))
		this.sun.position.copy(center).addScaledVector(direction, -(2 * extent + 100))
		this.sun.target.position.copy(center)
		this.sun.updateMatrixWorld()
		this.sun.target.updateMatrixWorld()
		const shadow = this.sun.shadow.camera
		shadow.left = -extent
		shadow.right = extent
		shadow.bottom = -extent
		shadow.top = extent
		shadow.far = 4 * extent + 200
		shadow.updateProjectionMatrix()
		box.set(center.clone().addScalar(-extent), center.clone().addScalar(extent))
		if (!this.coverage.equals(box)) {
			this.coverage.copy(box)
			this.markDirty()
		}
	}

	private clearLights() {
		for (const object of this.lights.values()) {
			this.group.remove(object)
			if (object instanceof THREE.SpotLight) this.group.remove(object.target)
			object.shadow.dispose()
		}
		this.lights.clear()
		this.selected.clear()
		this.activeLights = []
	}

	dispose() {
		if (this.disposed) return
		this.disposed = true
		this.clearLights()
		this.scene.remove(this.group)
		this.sun.shadow.dispose()
		this.environment?.dispose()
		this.sky?.dispose()
		this.generator.dispose()
		this.scene.background = this.previousBackground
		this.scene.environment = this.previousEnvironment
		this.scene.environmentIntensity = this.previousEnvironmentIntensity
		this.scene.fog = this.previousFog
		this.legacyLights.visible = true
		this.renderer.shadowMap.enabled = false
		this.renderer.shadowMap.autoUpdate = true
		this.renderer.toneMapping = THREE.NoToneMapping
	}
}
