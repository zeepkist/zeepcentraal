import * as THREE from 'three'
import type { GhostLevelBlock } from '../app/types/ghost'

export type LightingColor = [number, number, number]
export type LightingVector = [number, number, number]
export type GhostEnvironment = {
	sun: { direction: LightingVector; color: LightingColor; intensity: number; shadow: number }
	backlight: { direction: LightingVector; color: LightingColor; intensity: number }
	ambient: { top: LightingColor; mid: LightingColor; bottom: LightingColor }
	fog: { enabled: boolean; color: LightingColor; density: number }
	sky: {
		top: LightingColor
		upper?: LightingColor
		horizon: LightingColor
		bottom: LightingColor
		exposure: number
	}
	volumetrics: {
		density: number
		anisotropy: number
		color?: LightingColor
		useCustomColor?: boolean
		extinction?: number
		extinctionEffect?: number
		ambientStrength?: number
	}
	lampBrightness: number
}

export type ProtectedLightDefinition = {
	type: 'point' | 'spot'
	/** Root-relative Unity transform. No mesh-export axis correction. */
	matrix: number[]
	color: LightingColor
	intensity: number
	range: number
	angle: number
	innerAngle: number
	scale: boolean
	volumetric: boolean
	visibility?: Array<
		{ kind: 'attribute'; index: number } | { kind: 'hideLogicBlock' | 'hideTrigger' }
	>
	controller?: {
		kind: 'custom' | 'lamp' | 'logic'
		multiplier: number
		ignoreSkybox: boolean
		alwaysOn: boolean
		hue: number
		saturation: number
		brightness: number
		slots: {
			hue: number
			saturation: number
			brightness: number
			volumetric: number
			alwaysOn: number
		}
	}
}

export type GhostLight = {
	id: string
	type: 'point' | 'spot'
	position: LightingVector
	direction: LightingVector
	color: LightingColor
	intensity: number
	range: number
	angle: number
	penumbra: number
	volumetric: boolean
}

export type GhostLightingData = { environment: GhostEnvironment; lights: GhostLight[] }

export const DEFAULT_GHOST_ENVIRONMENT: GhostEnvironment = {
	sun: {
		direction: [0.572727954, -0.766044443, -0.291819468],
		color: [1, 0.95686275, 0.8392157],
		intensity: 1,
		shadow: 1,
	},
	backlight: {
		direction: [-0.133022222, -0.64278761, 0.754406507],
		color: [0.09, 0, 1],
		intensity: 0,
	},
	ambient: { top: [0.565, 0.502, 0.432], mid: [0.632, 0.612, 0.54], bottom: [0.217, 0.1, 0.009] },
	fog: { enabled: false, color: [0.782, 0.98, 0.952], density: 0.001 },
	sky: {
		top: [0, 0.224, 1],
		upper: [0.565, 0.50222224, 0.4315972],
		horizon: [0.7971698, 1, 0.97235376],
		bottom: [0.79607844, 1, 0.972549],
		exposure: 1,
	},
	volumetrics: {
		density: 0.005,
		anisotropy: 0.6,
		extinction: 0.05,
		extinctionEffect: 0,
		ambientStrength: 0.5,
	},
	lampBrightness: 0,
}

export function lightingRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

export function lightingNumber(value: unknown, fallback: number, maximum = 65_504): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(maximum, Math.max(0, value))
		: fallback
}

function color(value: unknown, fallback: LightingColor): LightingColor {
	const entry = lightingRecord(value)
	const channels = Array.isArray(value) ? value : [entry.r, entry.g, entry.b]
	return channels.map((value, index) =>
		lightingNumber(value, fallback[index] ?? 0),
	) as LightingColor
}

export function unityLightDirection(value: unknown): LightingVector {
	const entry = lightingRecord(value)
	const rotation = ['x', 'y', 'z'].map((key) => {
		const value = entry[key]
		return typeof value === 'number' && Number.isFinite(value) ? (value * Math.PI) / 180 : 0
	})
	const direction = new THREE.Vector3(0, 0, 1).applyEuler(
		new THREE.Euler(rotation[0], rotation[1], rotation[2], 'YXZ'),
	)
	direction.z *= -1
	return direction.toArray() as LightingVector
}

export function resolveGhostEnvironment(
	value: unknown,
	skybox: number,
	profiles: Record<string, GhostEnvironment> = {},
): GhostEnvironment {
	const base = profiles[String(skybox)] ?? DEFAULT_GHOST_ENVIRONMENT
	const saved = lightingRecord(value)
	const custom = lightingRecord(saved.skyboxOverride)
	const sun = lightingRecord(custom.sun),
		ambient = lightingRecord(custom.ambient)
	const fog = lightingRecord(custom.fog),
		sky = lightingRecord(custom.skybox)
	const volumetrics = lightingRecord(custom.volumetrics)
	const hasCustom = Object.keys(custom).length > 0
	return {
		sun: {
			direction: sun.r ? unityLightDirection(sun.r) : base.sun.direction,
			color: color(sun.c, base.sun.color),
			intensity: lightingNumber(sun.i, base.sun.intensity),
			shadow: lightingNumber(sun.sh, base.sun.shadow, 1),
		},
		backlight: {
			direction: sun.bltr ? unityLightDirection(sun.bltr) : base.backlight.direction,
			color: color(sun.bltc, base.backlight.color),
			intensity: hasCustom
				? sun._blt === true
					? lightingNumber(sun.blti, 1)
					: 0
				: base.backlight.intensity,
		},
		ambient: {
			top: color(ambient.t, base.ambient.top),
			mid: color(ambient.m, base.ambient.mid),
			bottom: color(ambient.b, base.ambient.bottom),
		},
		fog: {
			enabled: typeof fog._fg === 'boolean' ? fog._fg : base.fog.enabled,
			color: color(fog.c, base.fog.color),
			density:
				saved.overrideFog_b === true
					? lightingNumber(saved.overrideFog_f, base.fog.density, 1)
					: lightingNumber(fog.dn, base.fog.density, 1),
		},
		sky: {
			top: color(sky.s === 0 ? sky.c1 : sky.c4, base.sky.top),
			upper: color(sky.s === 0 ? sky.c1 : sky.c3, base.sky.upper ?? base.sky.top),
			horizon: color(sky.s === 0 ? sky.c1 : sky.c2, base.sky.horizon),
			bottom: color(sky.c1, base.sky.bottom),
			exposure: lightingNumber(sky.ex, base.sky.exposure, 16),
		},
		volumetrics: {
			density: lightingNumber(volumetrics.dn, base.volumetrics.density, 1),
			anisotropy: lightingNumber(volumetrics.mie, base.volumetrics.anisotropy, 0.95),
			color: color(volumetrics.c, base.volumetrics.color ?? [1, 1, 1]),
			useCustomColor:
				typeof volumetrics._c === 'boolean'
					? volumetrics._c
					: (base.volumetrics.useCustomColor ?? false),
			extinction: lightingNumber(volumetrics.x1, base.volumetrics.extinction ?? 0.05, 1),
			extinctionEffect: lightingNumber(
				volumetrics.x2,
				base.volumetrics.extinctionEffect ?? 0,
				1,
			),
			ambientStrength: lightingNumber(
				volumetrics.a,
				base.volumetrics.ambientStrength ?? 0.5,
				1,
			),
		},
		lampBrightness: lightingNumber(sun.dlb, base.lampBrightness),
	}
}

export function resolveGhostLights(
	blocks: readonly GhostLevelBlock[],
	definitions: Record<string, { lights?: ProtectedLightDefinition[] }>,
	environment: GhostEnvironment,
): GhostLight[] {
	const result: GhostLight[] = []
	const reflect = new THREE.Matrix4().makeScale(1, 1, -1)
	for (const [blockIndex, block] of blocks.entries()) {
		const definition = definitions[String(block.id)]
		if (!definition?.lights) continue
		const euler = new THREE.Euler(
			...([block.rotation.x, block.rotation.y, block.rotation.z].map(
				(value) => (value * Math.PI) / 180,
			) as [number, number, number]),
			'YXZ',
		)
		const matrix = new THREE.Matrix4().compose(
			new THREE.Vector3(block.position.x, block.position.y, block.position.z),
			new THREE.Quaternion().setFromEuler(euler),
			new THREE.Vector3(block.scale.x, block.scale.y, block.scale.z),
		)
		for (const [lightIndex, light] of definition.lights.entries()) {
			if (
				light.visibility?.some((condition) =>
					condition.kind === 'attribute'
						? block.attributes[condition.index] !== 0 &&
							block.attributes[condition.index] !== undefined
						: condition.kind === 'hideLogicBlock'
							? block.hideLogicBlock
							: block.hideTrigger,
				)
			)
				continue
			const local = new THREE.Matrix4().fromArray(light.matrix)
			const world = reflect.clone().multiply(matrix).multiply(local)
			const position = new THREE.Vector3().setFromMatrixPosition(world)
			const direction = new THREE.Vector3(0, 0, 1).transformDirection(world)
			const scale = new THREE.Vector3().setFromMatrixScale(world)
			scale.set(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
			let intensity = light.intensity,
				rgb = light.color,
				volumetric = light.volumetric
			let range = light.range,
				angle = light.angle,
				type = light.type
			const controller = light.controller
			const floats = block.floatOptions ?? {},
				booleans = block.booleanOptions ?? {}
			if (controller?.kind === 'custom') {
				const hue = floats.cl1 ?? block.attributes[controller.slots.hue] ?? controller.hue
				const saturation =
					floats.cl2 ??
					block.attributes[controller.slots.saturation] ??
					controller.saturation
				const brightness =
					floats.cl3 ??
					block.attributes[controller.slots.brightness] ??
					controller.brightness
				// Unity HSVToRGB: value stays 1; brightness belongs to intensity.
				const h = (((hue / 360) % 1) + 1) % 1,
					s = Math.min(1, Math.max(0, saturation))
				const x = h * 6,
					chroma = s,
					second = chroma * (1 - Math.abs((x % 2) - 1))
				const channels = [
					[chroma, second, 0],
					[second, chroma, 0],
					[0, chroma, second],
					[0, second, chroma],
					[second, 0, chroma],
					[chroma, 0, second],
				][Math.floor(x)] ?? [0, 0, 0]
				rgb = channels.map((channel) => channel + 1 - s) as LightingColor
				intensity = Math.max(0, brightness) * controller.multiplier
				volumetric =
					booleans.cl4 ??
					(block.attributes[controller.slots.volumetric] === undefined
						? light.volumetric
						: (block.attributes[controller.slots.volumetric] ?? 0) < 0.5)
			} else if (controller?.kind === 'lamp' && !controller.ignoreSkybox) {
				const alwaysOn =
					booleans[`o${controller.slots.alwaysOn}`] ??
					(block.attributes[controller.slots.alwaysOn] === undefined
						? controller.alwaysOn
						: Math.ceil(block.attributes[controller.slots.alwaysOn] ?? 0) === 1)
				intensity = (alwaysOn ? 1 : environment.lampBrightness) * controller.multiplier
			} else if (controller?.kind === 'logic') {
				const text = block.textOptions ?? {}
				range = lightingNumber(Number(text.oi2), range * 100) / 100
				angle = lightingNumber(Number(text.oi3), angle * 100, 17_900) / 100
				intensity = lightingNumber(Number(text.oi4), intensity * 100) / 100
				type = booleans.is === false ? 'point' : 'spot'
				volumetric = booleans.dv !== true
			}
			if (light.scale) {
				range *= (scale.x + scale.y + scale.z) / 3
				angle *= ((scale.x + scale.y) * 0.5) / Math.max(scale.z, 0.001)
			}
			if (
				!Number.isFinite(intensity) ||
				intensity <= 0 ||
				!Number.isFinite(range) ||
				range <= 0
			)
				continue
			result.push({
				id: `${blockIndex}:${lightIndex}`,
				type,
				position: position.toArray() as LightingVector,
				direction: direction.toArray() as LightingVector,
				color: rgb,
				intensity: Math.min(intensity, 65_504),
				range: Math.min(range, 50_000),
				angle: THREE.MathUtils.degToRad(Math.min(179, Math.max(1, angle))) / 2,
				penumbra: Math.min(1, Math.max(0, 1 - light.innerAngle / Math.max(light.angle, 1))),
				volumetric,
			})
		}
	}
	return result
}

/** Validate the untrusted JSON trailer before constructing GPU resources. */
export function validateGhostLightingData(value: unknown): GhostLightingData {
	const data = value as GhostLightingData
	if (!data?.environment || !Array.isArray(data.lights) || data.lights.length > 100_000)
		throw new Error('Malformed ghost lighting data')
	if (
		!['sun', 'backlight', 'ambient', 'fog', 'sky', 'volumetrics'].every(
			(key) =>
				Object.keys(
					lightingRecord((data.environment as unknown as Record<string, unknown>)[key]),
				).length > 0,
		)
	)
		throw new Error('Malformed ghost environment')
	const triples = [
		data.environment.sun.direction,
		data.environment.sun.color,
		data.environment.backlight.direction,
		data.environment.backlight.color,
		...Object.values(data.environment.ambient),
		data.environment.fog.color,
		data.environment.sky.top,
		data.environment.sky.horizon,
		data.environment.sky.bottom,
	]
	if (data.environment.sky.upper) triples.push(data.environment.sky.upper)
	if (data.environment.volumetrics.color) triples.push(data.environment.volumetrics.color)
	for (const light of data.lights) {
		if (
			!light ||
			!['point', 'spot'].includes(light.type) ||
			typeof light.id !== 'string' ||
			typeof light.volumetric !== 'boolean'
		)
			throw new Error('Malformed ghost light')
		triples.push(light.position, light.direction, light.color)
		if (
			![light.intensity, light.range, light.angle, light.penumbra].every(
				(value) => Number.isFinite(value) && value >= 0 && value <= 65_504,
			) ||
			light.range === 0 ||
			light.penumbra > 1 ||
			light.angle > Math.PI / 2
		)
			throw new Error('Malformed ghost light')
	}
	if (
		triples.some(
			(value) => !Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite),
		) ||
		![
			data.environment.sun.intensity,
			data.environment.sun.shadow,
			data.environment.backlight.intensity,
			data.environment.fog.density,
			data.environment.sky.exposure,
			data.environment.volumetrics.density,
			data.environment.volumetrics.anisotropy,
			data.environment.lampBrightness,
		].every((value) => Number.isFinite(value) && value >= 0)
	)
		throw new Error('Malformed ghost environment')
	if (
		typeof data.environment.fog.enabled !== 'boolean' ||
		data.environment.sun.shadow > 1 ||
		data.environment.volumetrics.anisotropy > 0.95 ||
		['extinction', 'extinctionEffect', 'ambientStrength'].some((key) => {
			const value = (data.environment.volumetrics as Record<string, unknown>)[key]
			return (
				value !== undefined &&
				(typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
			)
		}) ||
		triples.some((triple) => triple.some((value) => Math.abs(value) > 1e9))
	)
		throw new Error('Malformed ghost environment')
	return data
}
