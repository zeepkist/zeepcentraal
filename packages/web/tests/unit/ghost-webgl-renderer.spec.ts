import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveGhostRendererOptions } from '../../app/utils/ghostScene'
import {
	CLIENT_FS_STUB_ID,
	CLIENT_FS_STUB_SOURCE,
	resolveClientFsStubId,
} from '../../config/clientFsStub'

const viewer = readFileSync(
	new URL('../../app/components/record/GhostPlaybackViewer.client.vue', import.meta.url),
	'utf8',
)
const config = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
const packageManifest = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
const environmentExample = readFileSync(
	new URL('../../../../.env.example', import.meta.url),
	'utf8',
)

describe('Pure Three.js ghost renderer', () => {
	it('owns one imperative WebGL scene without Tres runtime dependencies', () => {
		expect(viewer).toContain('new THREE.WebGLRenderer')
		expect(viewer).toContain('new OrbitControls')
		expect(viewer).toContain('new Line2')
		expect(viewer).toContain('new CSS2DRenderer')
		expect(viewer).not.toMatch(/Tres|Cientos|BakeShadows/)
		expect(config).not.toContain('@tresjs/nuxt')
		expect(config).not.toContain('ghostRenderer')
		expect(packageManifest).not.toContain('@tresjs/')
		expect(environmentExample).not.toContain('NUXT_PUBLIC_GHOST_RENDERER')
	})

	it('keeps shadow maps disabled for every quality level', () => {
		expect(viewer).not.toMatch(/shadowMap|castShadow|receiveShadow/)
		expect(resolveGhostRendererOptions('performance')).toMatchObject({
			powerPreference: 'low-power',
			antialias: false,
			stencil: false,
		})
		expect(resolveGhostRendererOptions('balanced')).toMatchObject({
			powerPreference: 'low-power',
			antialias: true,
		})
		expect(resolveGhostRendererOptions('quality')).toMatchObject({
			powerPreference: 'high-performance',
			antialias: true,
		})
	})

	it('keeps optional protobuf filesystem loading client-only', () => {
		expect(resolveClientFsStubId('fs', false)).toBe(CLIENT_FS_STUB_ID)
		expect(resolveClientFsStubId('node:fs', false)).toBe(CLIENT_FS_STUB_ID)
		expect(resolveClientFsStubId('fs', true)).toBeNull()
		expect(resolveClientFsStubId('node:path', false)).toBeNull()
		expect(CLIENT_FS_STUB_SOURCE).toContain('export const readFile = undefined')
		expect(config).toContain('clientFsStub()')
	})
})
