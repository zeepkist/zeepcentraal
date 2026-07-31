import { describe, expect, it } from 'vitest'
import { sanitizeGhostPerformancePreferences } from '../../app/composables/useGhostPerformancePreferences'

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
})
