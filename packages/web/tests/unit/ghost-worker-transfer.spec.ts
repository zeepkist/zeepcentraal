import { parseGhostBrowser } from '@zeepkist/core/ghosts/browser'
import * as THREE from 'three'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { expect, it, vi } from 'vitest'
import {
	buildGhostGrid,
	rebaseGhostPosition,
	resolveGhostDisplayPosition,
	simplifyGhostTrailFrames,
} from '../../app/utils/ghostScene'
import { ghostPlaybackPayload } from '../fixtures/ghostPlayback'

it('builds finite grid and trail bounds from worker-transferred protobuf frames', async () => {
	const parsed = await parseGhostBrowser(new Uint8Array([1]), {
		decompressLzma: async () => ghostPlaybackPayload,
	})
	const { frames } = structuredClone(parsed)
	expect(frames[0]?.position).toEqual({ x: 0, y: 2, z: 0 })
	const grid = buildGhostGrid([frames])
	expect(grid.origin).toEqual({ x: 0, y: 0, z: 0 })
	const trail = simplifyGhostTrailFrames(frames, 'balanced', 6_000).flatMap((frame) => {
		const position = rebaseGhostPosition(resolveGhostDisplayPosition(frame), grid.origin)
		return [position.x, position.y + 0.1, position.z]
	})
	const gridPositions = [
		...[...grid.minorX, ...grid.majorX].flatMap((x) => [
			x,
			0,
			grid.minimumZ,
			x,
			0,
			grid.maximumZ,
		]),
		...[...grid.minorZ, ...grid.majorZ].flatMap((z) => [
			grid.minimumX,
			0,
			z,
			grid.maximumX,
			0,
			z,
		]),
	]
	expect(trail.every(Number.isFinite)).toBe(true)
	expect(gridPositions.every(Number.isFinite)).toBe(true)
	const errors = vi.spyOn(console, 'error')
	const trailGeometry = new LineGeometry()
	const gridGeometry = new THREE.BufferGeometry()
	try {
		trailGeometry.setPositions(trail)
		gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3))
		gridGeometry.computeBoundingSphere()
		for (const geometry of [trailGeometry, gridGeometry]) {
			expect(Number.isFinite(geometry.boundingSphere?.radius)).toBe(true)
			expect(geometry.boundingSphere?.center.toArray().every(Number.isFinite)).toBe(true)
		}
		expect(errors).not.toHaveBeenCalled()
	} finally {
		trailGeometry.dispose()
		gridGeometry.dispose()
		errors.mockRestore()
	}
})
