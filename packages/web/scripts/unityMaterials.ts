import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
	type ProtectedMeshMaterial,
	validateProtectedMeshMaterial,
} from '../shared/protectedMeshFormat'

// Unity built-in resource references have stable file IDs, not exported .shader.meta files.
const BUILTIN_SHADERS: Record<string, string> = {
	'46': 'Standard',
	'45': 'Standard (Specular setup)',
	'10708': 'Unlit/Color',
	'10755': 'Unlit/Texture',
}

export async function loadUnityMaterials(materialDirectory: string, shaderDirectory: string) {
	const shaders = new Map<string, { name: string; source: string }>()
	await Promise.all(
		(await readdir(shaderDirectory))
			.filter((file) => file.endsWith('.shader.meta'))
			.map(async (file) => {
				const [meta, source] = await Promise.all([
					readFile(join(shaderDirectory, file), 'utf8'),
					readFile(join(shaderDirectory, file.slice(0, -5)), 'utf8'),
				])
				const guid = meta.match(/^guid:\s*(\w+)/m)?.[1]
				const name = source.match(/Shader\s+"([^"]+)"/)?.[1]
				if (!guid || !name || shaders.has(guid))
					throw new Error(`Invalid shader mapping: ${file}`)
				shaders.set(guid, { name, source })
			}),
	)
	const materials: Record<string, ProtectedMeshMaterial> = {}
	const defaults: Array<{ material: string; properties: string[] }> = []
	const unresolved: Record<string, string> = {}
	await Promise.all(
		(await readdir(materialDirectory))
			.filter((file) => file.endsWith('.mat.meta'))
			.map(async (file) => {
				const [meta, source] = await Promise.all([
					readFile(join(materialDirectory, file), 'utf8'),
					readFile(join(materialDirectory, file.slice(0, -5)), 'utf8'),
				])
				const guid = meta.match(/^guid:\s*(\w+)/m)?.[1]
				const shaderGuid = source.match(/m_Shader:.*guid:\s*(\w+)/)?.[1]
				const builtinId = source.match(/m_Shader:.*fileID:\s*(\d+)/)?.[1]
				const shader =
					shaders.get(shaderGuid ?? '') ??
					(shaderGuid === '0000000000000000f000000000000000' &&
					BUILTIN_SHADERS[builtinId ?? '']
						? { name: BUILTIN_SHADERS[builtinId ?? ''] as string, source: '' }
						: undefined)
				if (!guid || materials[guid]) throw new Error(`Invalid material mapping: ${file}`)
				if (!shader) {
					unresolved[guid] = file
					return
				}
				const parsed = parseUnityMaterial(source, shader.name, shader.source)
				materials[guid] = parsed.material
				if (parsed.defaults.length)
					defaults.push({ material: file.slice(0, -5), properties: parsed.defaults })
			}),
	)
	return {
		materials,
		unresolved,
		defaults: defaults.sort((a, b) => a.material.localeCompare(b.material)),
	}
}

export function parseUnityMaterial(source: string, shaderName: string, shaderSource = '') {
	const defaults: string[] = []
	const scalar = (key: string, fallback: number) => {
		const raw = source.match(new RegExp(`^\\s*- ${key}:\\s*([^\\r\\n]+)`, 'm'))?.[1]
		if (raw !== undefined) return Number(raw)
		const shaderDefault = shaderSource.match(
			new RegExp(`${key}\\s*\\([^\\n]+\\)\\s*=\\s*([\\d.eE+-]+)`),
		)?.[1]
		if (shaderDefault !== undefined) return Number(shaderDefault)
		defaults.push(key)
		return fallback
	}
	const color = (
		key: string,
		fallback: [number, number, number, number],
	): [number, number, number, number] => {
		const raw = source.match(new RegExp(`^\\s*- ${key}:\\s*\\{([^}]+)\\}`, 'm'))?.[1]
		if (raw)
			return ['r', 'g', 'b', 'a'].map((channel) =>
				Number(raw.match(new RegExp(`${channel}:\\s*([^,]+)`))?.[1]),
			) as typeof fallback
		const shaderDefault = shaderSource.match(
			new RegExp(`${key}\\s*\\([^\\n]+\\)\\s*=\\s*\\(([^)]+)\\)`),
		)?.[1]
		if (shaderDefault) return shaderDefault.split(',').map(Number) as typeof fallback
		defaults.push(key)
		return fallback
	}
	const glass = /glass|transparent/i.test(shaderName)
	const workflow = /specular/i.test(shaderName) ? 'specular' : 'metallic'
	const rgba = color('_Color', [1, 1, 1, glass ? 0.5 : 1])
	const specular =
		workflow === 'specular' ? color('_SpecColor', [0.2, 0.2, 0.2, 1]) : [0.04, 0.04, 0.04, 1]
	const mode = scalar('_Mode', glass ? 3 : 0)
	const hasProperty = (key: string) =>
		new RegExp(`^\\s*- ${key}:|${key}\\s*\\(`, 'm').test(`${source}\n${shaderSource}`)
	const keywords = [
		source.match(/^\s*m_ShaderKeywords:[ \t]*([^\r\n]*)/m)?.[1] ?? '',
		source.match(/^\s*m_ValidKeywords:[ \t]*([^\r\n]*(?:\r?\n[ \t]*-[^\r\n]*)*)/m)?.[1] ?? '',
	].join(' ')
	const roughness = hasProperty('_Roughness')
		? scalar('_Roughness', 0.5)
		: hasProperty('_Smoothness')
			? 1 - scalar('_Smoothness', 0.5)
			: !hasProperty('_Glossiness') && hasProperty('_Shininess')
				? // Unity legacy shaders use exponent 128 * _Shininess. Approximate GGX finish.
					(2 / (128 * scalar('_Shininess', 0.5) + 2)) ** 0.25
				: 1 - scalar('_Glossiness', glass ? 0.12 : 0.5)
	const material = validateProtectedMeshMaterial({
		color: [rgba[0], rgba[1], rgba[2]],
		opacity: mode >= 2 || glass ? rgba[3] : 1,
		roughness,
		metalness: workflow === 'metallic' ? scalar('_Metallic', 0) : 0,
		specular: [specular[0] ?? 0.04, specular[1] ?? 0.04, specular[2] ?? 0.04],
		workflow,
		transparent: mode >= 2 || glass,
		doubleSided:
			/two.?face|double.?side/i.test(shaderName) ||
			/TwoFace/i.test(source.match(/m_Name: (.*)/)?.[1] ?? ''),
		...(hasProperty('_EmissionColor') &&
		(/\b_EMISSION\b/i.test(keywords) || /emissive|unlit/i.test(shaderName))
			? {
					emissive: color('_EmissionColor', [0, 0, 0, 1]).slice(0, 3) as [
						number,
						number,
						number,
					],
				}
			: {}),
	})
	return { material, defaults }
}
