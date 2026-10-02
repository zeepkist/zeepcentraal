import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type * as THREE from 'three'
import {
	DEFAULT_GHOST_ENVIRONMENT,
	type GhostEnvironment,
	type LightingColor,
	type ProtectedLightDefinition,
	unityLightDirection,
} from '../shared/ghostLighting'

type Document = { type: number; id: string; body: string }
const scalar = (body: string, key: string) =>
	body.match(new RegExp(`^  ${key}: (.*)$`, 'm'))?.[1]?.trim()
const number = (body: string, key: string, fallback: number) => {
	const value = Number(scalar(body, key))
	return Number.isFinite(value) ? value : fallback
}
const fileId = (body: string, key: string) => scalar(body, key)?.match(/fileID: (-?\d+)/)?.[1]
const scriptName = (body: string, scripts: ReadonlyMap<string, string>) =>
	scripts.get(scalar(body, 'm_Script')?.match(/guid: (\w+)/)?.[1] ?? '')
function vector(body: string, key: string, channels: string[], fallback: number[]) {
	const text = scalar(body, key) ?? ''
	return channels.map((channel, index) => {
		const value = Number(text.match(new RegExp(`${channel}: ([^,}]+)`))?.[1])
		return Number.isFinite(value) ? value : (fallback[index] ?? 0)
	})
}

export function extractUnityLights(
	documents: Document[],
	scripts: ReadonlyMap<string, string>,
	transform: (gameObjectId: string) => THREE.Matrix4 | null,
	visibility: (gameObjectId: string) => {
		visible: boolean
		conditions: NonNullable<ProtectedLightDefinition['visibility']>
	},
): ProtectedLightDefinition[] {
	const behaviours = documents.filter((document) => document.type === 114)
	const result: ProtectedLightDefinition[] = []
	for (const document of documents.filter((document) => document.type === 108)) {
		const gameObject = fileId(document.body, 'm_GameObject') ?? ''
		const matrix = transform(gameObject),
			state = visibility(gameObject)
		const type = number(document.body, 'm_Type', -1)
		if (!matrix || !state.visible || ![0, 2].includes(type)) continue
		const brightness = behaviours.find(
			(behaviour) =>
				scriptName(behaviour.body, scripts) === 'LampBrightness' &&
				fileId(behaviour.body, 'lamp') === document.id,
		)
		const custom = behaviours.find(
			(behaviour) =>
				scriptName(behaviour.body, scripts) === 'BlockEdit_CustomLight' &&
				fileId(behaviour.body, 'brightnessScript') === brightness?.id,
		)
		const always = behaviours.find(
			(behaviour) =>
				scriptName(behaviour.body, scripts) === 'BlockEdit_LightAlwaysOn' &&
				fileId(behaviour.body, 'brightnessScript') === brightness?.id,
		)
		const logic = behaviours.find(
			(behaviour) =>
				scriptName(behaviour.body, scripts) === 'LogicScript_DynamicLight' &&
				fileId(behaviour.body, 'theLight') === document.id,
		)
		if (scalar(document.body, 'm_Enabled') === '0' && !brightness && !logic) continue
		const lamp = brightness?.body ?? ''
		const controller = custom?.body ?? always?.body ?? logic?.body ?? ''
		result.push({
			type: type === 0 ? 'spot' : 'point',
			matrix: matrix.toArray(),
			color: vector(document.body, 'm_Color', ['r', 'g', 'b'], [1, 1, 1]) as LightingColor,
			intensity: logic
				? number(logic.body, 'overrideInputIntensity', 1000) / 100
				: number(document.body, 'm_Intensity', 1),
			range: logic
				? number(logic.body, 'overrideInputRange', 100000) / 100
				: number(lamp, 'originalRange', number(document.body, 'm_Range', 10)),
			angle: logic
				? Math.min(179, number(logic.body, 'overrideInputAngle', 9000) / 100)
				: number(lamp, 'originalAngle', number(document.body, 'm_SpotAngle', 90)),
			innerAngle: number(document.body, 'm_InnerSpotAngle', 0),
			scale: scalar(lamp, 'useScaling') === '1',
			volumetric: custom
				? scalar(custom.body, 'volumetric') !== '0'
				: Boolean(brightness || logic),
			// Hide-in-game applies to logic icons, never to emitted light.
			...(state.conditions.some((condition) => condition.kind === 'attribute')
				? {
						visibility: state.conditions.filter(
							(condition) => condition.kind === 'attribute',
						),
					}
				: {}),
			...(brightness || logic
				? {
						controller: {
							kind: logic
								? ('logic' as const)
								: custom
									? ('custom' as const)
									: ('lamp' as const),
							multiplier: number(lamp, 'intensityMultiplier', 6),
							ignoreSkybox: scalar(lamp, 'ignoreSkyboxEntirely') === '1',
							alwaysOn: scalar(controller, 'alwaysOn') === '1',
							hue: number(controller, 'color018', 0),
							saturation: number(controller, 'saturation', 1),
							brightness: number(controller, 'brightness', 1),
							slots: {
								hue: number(controller, 'NUMBER_color', 1),
								saturation: number(controller, 'NUMBER_saturation', 3),
								brightness: number(controller, 'NUMBER_brightness', 5),
								volumetric: number(controller, 'NUMBER_volumetric', 6),
								alwaysOn: number(controller, 'valueNR', 0),
							},
						},
					}
				: {}),
		})
	}
	return result
}

/** Resolve profile order from SkyboxManager, never from alphabetic prefab names. */
export async function loadUnitySkyProfiles(
	gameObjects: string,
	scripts: ReadonlyMap<string, string>,
): Promise<Record<string, GhostEnvironment>> {
	const directory = join(dirname(gameObjects), 'Scenes', '_Production Scenes')
	let source: string
	try {
		source = await readFile(join(directory, 'GameScene.unity'), 'utf8')
	} catch {
		return {}
	}
	const managerGuid = [...scripts].find(([, name]) => name === 'SkyboxManager')?.[0]
	if (!managerGuid) return {}
	const documents = source.split(/^--- !u!\d+ &-?\d+.*$/m)
	const manager = documents.find((body) => body.includes(`guid: ${managerGuid},`))
	const references = manager?.match(/\n {2}profiles:\s*\n((?: {2}- .*\n)+)/)?.[1]
	if (!references) return {}
	const names = await readdir(gameObjects)
	const files = names.filter((name) => name.endsWith('.prefab.meta'))
	const required = new Set([...references.matchAll(/guid: (\w+)/g)].map((match) => match[1]))
	const prefabs = new Map<string, string>()
	const pending = files.values()
	await Promise.all(
		Array.from({ length: 16 }, async () => {
			for (const name of pending) {
				const meta = await readFile(join(gameObjects, name), 'utf8')
				const guid = meta.match(/^guid: (\w+)/m)?.[1]
				if (guid && required.has(guid))
					prefabs.set(guid, await readFile(join(gameObjects, name.slice(0, -5)), 'utf8'))
			}
		}),
	)
	const result: Record<string, GhostEnvironment> = {}
	const materialDirectory = join(dirname(gameObjects), 'Material')
	const materials = new Map<string, string>()
	try {
		await Promise.all(
			(await readdir(materialDirectory))
				.filter((name) => name.endsWith('.mat.meta'))
				.map(async (name) => {
					const meta = await readFile(join(materialDirectory, name), 'utf8')
					const guid = meta.match(/^guid: (\w+)/m)?.[1]
					if (guid) materials.set(guid, join(materialDirectory, name.slice(0, -5)))
				}),
		)
	} catch {
		/* Synthetic exports can omit sky materials. */
	}
	for (const [index, reference] of references.trim().split('\n').entries()) {
		const guid = reference.match(/guid: (\w+)/)?.[1]
		const id = reference.match(/fileID: (-?\d+)/)?.[1]
		const body = guid
			? prefabs.get(guid)
			: documents.find(
					(body) =>
						body.includes(`m_Script:`) &&
						body.includes('sunIntensity:') &&
						source.includes(`&${id}\n${body}`),
				)
		if (!body) continue
		const rotation = vector(body, 'sunEuler', ['x', 'y', 'z'], [130, 243, 180])
		const ambient = {
			top: vector(
				body,
				'top',
				['r', 'g', 'b'],
				DEFAULT_GHOST_ENVIRONMENT.ambient.top,
			) as LightingColor,
			mid: vector(
				body,
				'mid',
				['r', 'g', 'b'],
				DEFAULT_GHOST_ENVIRONMENT.ambient.mid,
			) as LightingColor,
			bottom: vector(
				body,
				'low',
				['r', 'g', 'b'],
				DEFAULT_GHOST_ENVIRONMENT.ambient.bottom,
			) as LightingColor,
		}
		const material = materials.get(scalar(body, 'skybox')?.match(/guid: (\w+)/)?.[1] ?? '')
		const skyMaterial = material
			? (await readFile(material, 'utf8')).replace(/^\s*- (_\w+):/gm, '  $1:')
			: ''
		const sky = {
			top: vector(skyMaterial, '_TopColor', ['r', 'g', 'b'], ambient.top) as LightingColor,
			upper: vector(
				skyMaterial,
				'_MiddleTopColor',
				['r', 'g', 'b'],
				ambient.top,
			) as LightingColor,
			horizon: vector(
				skyMaterial,
				'_MiddleColor',
				['r', 'g', 'b'],
				ambient.mid,
			) as LightingColor,
			bottom: vector(
				skyMaterial,
				'_BottomColor',
				['r', 'g', 'b'],
				ambient.bottom,
			) as LightingColor,
			exposure: number(skyMaterial, '_Exposure', 1),
		}
		result[String(index)] = {
			...DEFAULT_GHOST_ENVIRONMENT,
			sun: {
				direction: unityLightDirection(
					Object.fromEntries(['x', 'y', 'z'].map((key, i) => [key, rotation[i]])),
				),
				color: vector(body, 'sunColor', ['r', 'g', 'b'], [1, 1, 1]) as LightingColor,
				intensity: number(body, 'sunIntensity', 1),
				shadow: number(body, 'shadowIntensity', 1),
			},
			ambient,
			fog: {
				enabled: scalar(body, 'FOG_Eanbled') === '1',
				color: vector(
					body,
					'FOG_Color',
					['r', 'g', 'b'],
					DEFAULT_GHOST_ENVIRONMENT.fog.color,
				) as LightingColor,
				density: number(body, 'FOG_Density', 0.001),
			},
			lampBrightness: number(body, 'lampBrightness', 0),
			sky,
			backlight: {
				direction: unityLightDirection({ x: 40, y: 190, z: 0 }),
				color: [0.09, 0, 1],
				intensity: scalar(body, 'have_lazercityBacklight') === '1' ? 0.5 : 0,
			},
			volumetrics: {
				density: number(body, 'HX_Density', 0.005),
				anisotropy: number(body, 'HX_Mie', 0.6),
				color: vector(body, 'HX_Color', ['r', 'g', 'b'], [1, 1, 1]) as LightingColor,
				useCustomColor: scalar(body, 'HX_CustomColor') === '1',
				extinction: 0.05,
				extinctionEffect: 0,
				ambientStrength: 0.5,
			},
		}
	}
	return result
}
