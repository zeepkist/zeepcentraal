import { describe, expect, it } from 'vitest'
import {
	resolveGhostFrameRate,
	resolveGhostRenderQuality,
	sanitizeGhostPerformancePreferences,
} from '../../app/composables/useGhostPerformancePreferences'

describe('ghost performance preferences', () => {
	it('enables level geometry and trails for existing saved preferences', () => {
		expect(
			sanitizeGhostPerformancePreferences({
				version: 1,
				frameRate: 60,
				renderQuality: 'quality',
			}),
		).toEqual({
			version: 1,
			frameRate: 60,
			renderQuality: 'quality',
			showLevelGeometry: true,
			showGhostTrails: true,
		})
	})

	it('preserves disabled geometry and trail settings', () => {
		expect(
			sanitizeGhostPerformancePreferences({
				version: 1,
				frameRate: 30,
				renderQuality: 'performance',
				showLevelGeometry: false,
				showGhostTrails: false,
			}),
		).toMatchObject({
			showLevelGeometry: false,
			showGhostTrails: false,
		})
	})

	it('defaults mobile devices to performance rendering at 30 FPS', () => {
		expect(resolveGhostFrameRate('auto', true)).toBe(30)
		expect(resolveGhostRenderQuality('auto', true)).toBe('performance')
		expect(resolveGhostFrameRate('auto', false)).toBe(60)
		expect(resolveGhostRenderQuality('auto', false)).toBe('quality')
	})

	it('preserves explicit mobile overrides', () => {
		expect(resolveGhostFrameRate(60, true)).toBe(60)
		expect(resolveGhostRenderQuality('balanced', true)).toBe('balanced')
	})
})
