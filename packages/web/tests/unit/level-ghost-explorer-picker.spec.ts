import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync(
	new URL('../../app/components/level/LevelGhostExplorerPicker.vue', import.meta.url),
	'utf8',
)

describe('LevelGhostExplorerPicker', () => {
	it('keeps requests outside the presentation component', () => {
		for (const request of ['useQuery(', 'useFetch(', '$fetch(', 'fetch(']) {
			expect(component).not.toContain(request)
		}
	})

	it('offers all bulk preset sizes and kinds through emitted actions', () => {
		expect(component).toContain('LEVEL_GHOST_PRESET_COUNTS')
		expect(component).toContain("'personal-bests': 10")
		expect(component).toContain("'global-records': 10")
		expect(component).toContain("'viewer-records': 10")
		expect(component).toContain(
			'loadPreset: [kind: LevelGhostPresetKind, count: LevelGhostPresetCount]',
		)
	})

	it('locks individual edits while retaining presets and Clear all', () => {
		expect(component).toContain('props.bulkLocked || props.selected.length >= 10')
		expect(component).toContain('v-if="selected.length && !bulkLocked"')
		expect(component).toContain('v-if="bulkLocked"')
		expect(component).toContain("$emit('loadPreset', preset.kind, presetCounts[preset.kind])")
		expect(component).toContain("$emit('clear')")
	})

	it('reports loading progress and the follow limit', () => {
		expect(component).toContain('labels.progress(loadedCount, loadingCount, failedCount)')
		expect(component).toContain('selected.length > followLimit')
		expect(component).toContain('labels.followLimit')
	})
})
