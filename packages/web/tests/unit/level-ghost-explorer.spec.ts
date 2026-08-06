import { readFileSync } from 'node:fs'
import { buildSchema, parse, validate } from 'graphql'
import { describe, expect, it } from 'vitest'
import type { GhostRecordSource } from '../../app/types/ghost'
import { LEVEL_GHOST_PRESET_COUNTS } from '../../app/types/levelGhostExplorer'
import {
	addIndividualLevelGhost,
	buildInitialLevelGhostSelection,
	buildLevelGhostFollowRecordIds,
	buildLevelGhostPresetFilter,
	buildPresetLevelGhostSelection,
	clearLevelGhostSelection,
	deduplicateLevelGhostSources,
	isLevelGhostBulkLocked,
	isLevelGhostPresetCount,
	removeIndividualLevelGhost,
} from '../../app/utils/levelGhostSelection'

const explorerQuery = readFileSync(
	new URL('../../../graphql/documents/web/queries/levelGhostExplorer.graphql', import.meta.url),
	'utf8',
)
const sharedFragment = readFileSync(
	new URL('../../../graphql/documents/web/queries/ghostRecordSource.graphql', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useLevelGhostExplorer.ts', import.meta.url),
	'utf8',
)
const viewer = readFileSync(
	new URL('../../app/components/record/GhostPlaybackViewer.client.vue', import.meta.url),
	'utf8',
)
const controls = readFileSync(
	new URL('../../app/components/record/GhostPlaybackControls.vue', import.meta.url),
	'utf8',
)
const settings = readFileSync(
	new URL('../../app/components/record/GhostPerformanceSettings.vue', import.meta.url),
	'utf8',
)
const workspace = readFileSync(
	new URL('../../app/components/record/RecordReplayWorkspace.vue', import.meta.url),
	'utf8',
)
const recordExperience = readFileSync(
	new URL('../../app/components/record/RecordGhostExperience.client.vue', import.meta.url),
	'utf8',
)
const levelExplorer = readFileSync(
	new URL('../../app/components/level/LevelGhostExplorerTab.client.vue', import.meta.url),
	'utf8',
)
const tournamentExplorer = readFileSync(
	new URL('../../app/components/tournament/TournamentGhostExplorer.vue', import.meta.url),
	'utf8',
)
const schema = buildSchema(
	readFileSync(new URL('../../../graphql/schema.graphql', import.meta.url), 'utf8'),
)

function source(
	recordId: number,
	time = recordId,
	overrides: Partial<GhostRecordSource> = {},
): GhostRecordSource {
	return {
		recordId,
		levelId: 42,
		userId: recordId,
		userSteamId: String(recordId),
		userName: `Player ${recordId}`,
		time,
		dateCreated: '2026-01-01T00:00:00Z',
		ghostUrl: `https://cdn.example.test/${recordId}.ghost`,
		mediaRevision: null,
		isWorldRecord: false,
		isPersonalBest: true,
		...overrides,
	}
}

describe('level ghost explorer GraphQL', () => {
	it('validates operations against current schema', () => {
		const errors = validate(schema, parse(`${sharedFragment}\n${explorerQuery}`))
		expect(errors.map((error) => error.message)).toEqual([])
	})

	it('requests bounded presets and searchable personal best users', () => {
		expect(explorerQuery).toContain('query ZC_LevelGhostPreset($first: Int!')
		expect(explorerQuery).toContain(
			'records(first: $first, filter: $filter, orderBy: [TIME_ASC, ID_ASC])',
		)
		expect(explorerQuery).toContain('first: 8')
		expect(explorerQuery).toContain('orderBy: [STEAM_NAME_ASC, ID_ASC]')
		expect(explorerQuery).toContain('recordMedia: { ghostUrl: { isNull: false } }')
		expect(explorerQuery).toContain('recordMediaExists: true')
		expect(explorerQuery).not.toContain('offset:')
	})

	it('keeps every request client-only and gated by selected tab', () => {
		expect(composable.match(/import\.meta\.server \|\|/g)?.length).toBeGreaterThanOrEqual(3)
		expect(composable.match(/!hydrated\.value \|\|/g)?.length).toBeGreaterThanOrEqual(3)
		expect(composable.match(/!options\.active\.value \|\|/g)?.length).toBeGreaterThanOrEqual(3)
		expect(composable).toContain('LEVEL_GHOST_SEARCH_MINIMUM_LENGTH = 2')
		expect(composable).toContain('LEVEL_GHOST_SEARCH_DEBOUNCE_MS = 250')
		expect(composable).toContain('LEVEL_GHOST_USER_LIMIT = 8')
	})

	it('loads and renders protected terrain only for authenticated sessions', () => {
		expect(viewer).toContain(
			'const canLoadProtectedMeshes = computed(() => session.user !== null)',
		)
		expect(viewer).toContain('if (!canLoadProtectedMeshes.value || !props.showLevelGeometry)')
		expect(viewer).toContain('levelMeshRenderer?.clear()')
		expect(viewer).toContain('?.loadGhostModels()')
		expect(viewer).not.toContain('if (!canLoadProtectedMeshes.value) return')
	})
})

describe('level ghost selection', () => {
	it('accepts exact preset counts only', () => {
		expect(LEVEL_GHOST_PRESET_COUNTS).toEqual([3, 5, 10, 25, 50, 100, 200])
		for (const count of LEVEL_GHOST_PRESET_COUNTS)
			expect(isLevelGhostPresetCount(count)).toBe(true)
		expect(isLevelGhostPresetCount(4)).toBe(false)
		expect(isLevelGhostPresetCount(201)).toBe(false)
	})

	it('builds correct preset filters', () => {
		const base = {
			levelId: { equalTo: 42 },
			recordMedia: { ghostUrl: { isNull: false } },
			recordMediaExists: true,
		}
		expect(buildLevelGhostPresetFilter('global-records', 42)).toEqual(base)
		expect(buildLevelGhostPresetFilter('personal-bests', 42)).toEqual({
			...base,
			personalBestGlobalsExist: true,
		})
		expect(buildLevelGhostPresetFilter('viewer-records', 42, 7)).toEqual({
			...base,
			userId: { equalTo: 7 },
		})
		expect(buildLevelGhostPresetFilter('viewer-records', 42)).toBeNull()
	})

	it('orders viewer personal best before distinct world record', () => {
		const viewer = source(8, 12)
		const worldRecord = source(1, 10, { isWorldRecord: true })
		expect(
			buildInitialLevelGhostSelection(viewer, worldRecord).map((item) => item.recordId),
		).toEqual([8, 1])
		expect(buildInitialLevelGhostSelection(worldRecord, worldRecord)).toEqual([worldRecord])
		expect(buildInitialLevelGhostSelection(null, worldRecord)).toEqual([worldRecord])
	})

	it('prepends pinned records and deduplicates preset results', () => {
		const viewer = source(8, 12)
		const worldRecord = source(1, 10, { isWorldRecord: true })
		const preset = [worldRecord, source(2, 11), viewer, source(3, 13)]
		expect(
			buildPresetLevelGhostSelection(viewer, worldRecord, preset).map(
				(item) => item.recordId,
			),
		).toEqual([8, 1, 2, 3])
		expect(deduplicateLevelGhostSources([source(4), source(4), null])).toHaveLength(1)
		expect(deduplicateLevelGhostSources([source(5, 5, { ghostUrl: null })])).toEqual([])
	})

	it('allows individual edits through ten and locks bulk sets', () => {
		let records = Array.from({ length: 9 }, (_, index) => source(index + 1))
		records = addIndividualLevelGhost(records, source(10))
		expect(records).toHaveLength(10)
		expect(addIndividualLevelGhost(records, source(11))).toHaveLength(10)
		expect(removeIndividualLevelGhost(records, 10)).toHaveLength(9)

		const bulk = Array.from({ length: 11 }, (_, index) => source(index + 1))
		expect(isLevelGhostBulkLocked(records)).toBe(false)
		expect(isLevelGhostBulkLocked(bulk)).toBe(true)
		expect(removeIndividualLevelGhost(bulk, 11)).toHaveLength(11)
		expect(clearLevelGhostSelection()).toEqual([])
	})

	it('follows viewer then WR then fastest available records with twelve-item cap', () => {
		const worldRecord = source(1, 10, { isWorldRecord: true })
		const viewer = source(20, 40)
		const records = [
			...Array.from({ length: 18 }, (_, index) => source(index + 1, 10 + index)),
			viewer,
		]
		const ids = buildLevelGhostFollowRecordIds({
			sources: records,
			viewerPersonalBest: viewer,
			worldRecord,
			unavailableRecordIds: new Set([2]),
		})

		expect(ids).toHaveLength(12)
		expect(ids.slice(0, 2)).toEqual([20, 1])
		expect(ids).not.toContain(2)
		expect(new Set(ids).size).toBe(ids.length)
	})
})

describe('level bulk ghost rendering', () => {
	it('reconciles keyed visuals, instances every model, and limits labels', () => {
		expect(viewer).toContain('planGhostVisualReconciliation(')
		expect(viewer).toContain('ghostMeshBatch?.configure(descriptors)')
		expect(viewer).toContain('new GhostLevelMeshRenderer(')
		expect(viewer).toContain(
			'levelMeshRenderer?.render(props.levelId, props.levelBlocks, grid.origin)',
		)
		expect(viewer).toContain('new ProtectedMeshLibrary()')
		expect(viewer).not.toContain('createLightweightMarker(')
		expect(viewer).not.toContain('new THREE.BoxGeometry(2, 2, 2)')
		expect(viewer).toContain('isLabeledGhost(loaded.record.recordId)')
		expect(viewer).toContain('resolveGhostTrailSampleLimit(')
		expect(workspace).toContain('return [...ordered, ...remaining].slice(0, 12)')
		expect(workspace).toContain('return props.ghosts.slice(0, 12)')
		expect(workspace).toContain(':label-record-ids="labelRecordIdList"')
	})

	it('unmounts WebGL when inactive and can render a cleared empty state', () => {
		expect(workspace).toContain('v-else-if="active"')
		expect(workspace).toContain('if (!active) playing.value = false')
		expect(workspace).toContain('loadingWhenEmpty: true')
		expect(workspace).toContain('props.loadingWhenEmpty && props.states.size === 0')
	})

	it('keeps settings and fullscreen controls in every workspace context', () => {
		expect(controls).toContain('<slot name="settings" />')
		expect(controls).toContain('@click="$emit(\'fullscreen\')"')
		expect(workspace).toContain('@fullscreen="toggleFullscreen"')
		expect(workspace).toContain('element.requestFullscreen()')
		expect(workspace).toContain('document.exitFullscreen()')
		for (const context of [recordExperience, levelExplorer, tournamentExplorer]) {
			expect(context).toContain('<template #settings>')
			expect(context).toContain('<GhostPerformanceSettings')
			expect(context).toContain(':show-level-geometry=')
			expect(context).toContain(':show-ghost-trails=')
			expect(context).toContain('@update:show-level-geometry=')
			expect(context).toContain('@update:show-ghost-trails=')
		}
		expect(settings).toContain(':model-value="preferences.showLevelGeometry"')
		expect(settings).toContain(':model-value="preferences.showGhostTrails"')
		expect(workspace).toContain(':show-level-geometry="showLevelGeometry"')
		expect(workspace).toContain(':show-ghost-trails="showGhostTrails"')
		expect(viewer).toContain('levelMeshRenderer?.clear()')
		expect(viewer).toContain('visual.trail.visible = props.showGhostTrails')
	})

	it('supports panning and performance-friendly trail rendering', () => {
		expect(viewer).toContain('controls.enablePan = true')
		expect(viewer).toContain('controls.mouseButtons.RIGHT = THREE.MOUSE.PAN')
		expect(viewer).toContain('controls.touches.TWO = THREE.TOUCH.DOLLY_PAN')
		expect(viewer).toContain('resolveGhostRendererOptions(quality)')
		expect(viewer).not.toContain('alphaToCoverage: true')
		expect(viewer).not.toContain('depthWrite: false')
		expect(viewer).not.toContain('trail.frustumCulled = false')
		expect(viewer).toContain('calculateIsometricCameraDepth(grid)')
		expect(viewer).toContain("scene.fog = props.cameraMode === 'isometric' ? null : orbitFog")
	})

	it('uses WebGL renderer and lines with quality-selected power preference', () => {
		expect(viewer).toContain("import * as THREE from 'three'")
		expect(viewer).toContain("from 'three/addons/lines/Line2.js'")
		expect(viewer).toContain("from 'three/addons/lines/LineMaterial.js'")
		expect(viewer).toContain('new THREE.WebGLRenderer({')
		expect(viewer).toContain('...options,')
		expect(viewer).toContain('controls.disconnect()')
		expect(viewer).toContain('controls.connect(candidate.domElement)')
		expect(viewer).toContain("addEventListener('webglcontextlost', onContextLost)")
		expect(viewer).toContain('visual.trailMaterial.resolution.set(width, height)')
		expect(viewer).not.toContain('WebGPURenderer')
		expect(viewer).not.toContain('Line2NodeMaterial')
		expect(viewer).not.toContain('candidate.init()')
		expect(viewer).not.toContain('rendererRevision')
	})

	it('reports measured FPS alongside target FPS', () => {
		expect(viewer).toContain('const currentFrameRate = shallowRef(0)')
		expect(viewer).toContain('recordRenderedFrame(timestamp)')
		expect(viewer).toContain('labels.frameRate(currentFrameRate, frameRate)')
	})

	it('coalesces demand rendering and suspends hidden playback', () => {
		expect(viewer).toContain('new GhostFrameScheduler(')
		expect(viewer).toContain('(callback) => requestAnimationFrame(callback)')
		expect(viewer).toContain('(handle) => cancelAnimationFrame(handle)')
		expect(viewer).toContain('useElementVisibility(container, { initialValue: true })')
		expect(viewer).toContain('watch(renderingVisible, (visible) => {')
		expect(viewer).toContain('if (props.playing || renderRequested) frameScheduler?.request()')
		expect(viewer).toContain('const updateRequired = ghostStateDirty')
		expect(viewer).not.toContain('animationFrame = requestAnimationFrame(renderLoop)')
	})
})
