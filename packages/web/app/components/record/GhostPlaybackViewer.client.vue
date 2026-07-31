<template>
	<div
		ref="container"
		class="ghost-viewer relative aspect-video min-h-80 w-full overflow-hidden rounded-2xl border border-border bg-default shadow-sm"
	>
		<div ref="canvasHost" class="absolute inset-0" />
		<div ref="labelHost" class="pointer-events-none absolute inset-0 overflow-hidden" />
		<div class="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
			<UBadge color="neutral" variant="soft">
				{{ labels.frameRate(currentFrameRate, frameRate) }}
			</UBadge>
			<UBadge v-if="showLevelGeometry && levelBlocks.length" color="neutral" variant="soft">
				{{ labels.approximateGeometry }}
			</UBadge>
		</div>
		<div
			v-if="ghosts.length === 0"
			class="absolute inset-0 grid place-items-center bg-default/80 p-6 text-center"
		>
			<div>
				<TablerIcon name="ghost-3" class="mx-auto size-12 text-muted" />
				<p class="mt-3 font-semibold text-highlighted">{{ labels.emptyTitle }}</p>
				<p class="mt-1 max-w-md text-sm text-muted">{{ labels.emptyDescription }}</p>
			</div>
		</div>
		<div
			v-if="rendererError"
			class="absolute inset-0 grid place-items-center bg-default/90 p-6 text-center"
		>
			<UAlert color="error" :title="labels.unavailableTitle" :description="labels.unavailableDescription" />
		</div>
		<div
			v-if="contextLost"
			class="absolute inset-0 grid place-items-center bg-default/90 p-6 text-center"
		>
			<UAlert color="warning" :title="labels.contextLostTitle" :description="labels.contextLostDescription" />
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type {
	GhostCameraMode,
	GhostGridModel,
	GhostLevelBlock,
	LoadedPlaybackGhost,
} from '~/types/ghost'
import { GhostLevelMeshRenderer } from '~/utils/ghostLevelMeshRenderer.client'
import {
	GhostMeshBatchRenderer,
	type GhostMeshDescriptor,
} from '~/utils/ghostMeshBatch.client'
import {
	buildGhostGrid,
	calculateGhostLabelWorldOffset,
	calculateIsometricCameraDepth,
	interpolateGhostFrame,
	orthographicWorldUnitsPerPixel,
	perspectiveWorldUnitsPerPixel,
	planGhostVisualReconciliation,
	rebaseGhostPosition,
	resolveGhostDisplayPosition,
	resolveGhostTrailSampleLimit,
	sampleGhostTrailFrames,
} from '~/utils/ghostScene'
import { resolveGhostWheelColor } from '~/utils/ghostSoapbox'
import { loadGhostSoapboxGeometries } from '~/utils/ghostSoapboxModel.client'

type RenderQuality = 'performance' | 'balanced' | 'quality'

type GhostVisual = {
	ghost: LoadedPlaybackGhost
	revision: string
	group: THREE.Group
	label: HTMLElement | null
	labelObject: CSS2DObject | null
	labelStagger: number
	trail: Line2
	trailGeometry: LineGeometry
	trailMaterial: LineMaterial
	trailTimes: number[]
}

const props = withDefaults(defineProps<{
	ghosts: LoadedPlaybackGhost[]
	levelBlocks: GhostLevelBlock[]
	showLevelGeometry?: boolean
	showGhostTrails?: boolean
	labelRecordIds?: number[]
	bulkMode?: boolean
	bulkGhostCount?: number
	sceneRevision?: number | string
	currentTime: number
	playing: boolean
	playbackRate: number
	loop: boolean
	selectedRecordId: number | null
	cameraMode: GhostCameraMode
	following: boolean
	frameRate: 30 | 60
	quality: RenderQuality
	labels: {
		frameRate: (current: number, target: number) => string
		approximateGeometry: string
		emptyTitle: string
		emptyDescription: string
		contextLostTitle: string
		contextLostDescription: string
		unavailableTitle: string
		unavailableDescription: string
	}
}>(), {
	bulkMode: false,
	sceneRevision: 0,
	showLevelGeometry: true,
	showGhostTrails: true,
})

const emit = defineEmits<{
	'update:currentTime': [value: number]
	'update:playing': [value: boolean]
	'update:following': [value: boolean]
}>()

const config = useRuntimeConfig()
const container = useTemplateRef('container')
const canvasHost = useTemplateRef('canvasHost')
const labelHost = useTemplateRef('labelHost')
const contextLost = ref(false)
const rendererError = ref(false)
const currentFrameRate = ref(0)

let renderer: THREE.WebGLRenderer | null = null
let labelRenderer: CSS2DRenderer | null = null
let scene: THREE.Scene | null = null
let orbitFog: THREE.Fog | null = null
let perspectiveCamera: THREE.PerspectiveCamera | null = null
let orthographicCamera: THREE.OrthographicCamera | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let lastRenderedAt = 0
let lastPlaybackAt = 0
let frameRateWindowStartedAt = 0
let renderedFrameCount = 0
let grid: GhostGridModel | null = null
let visuals = new Map<number, GhostVisual>()
let ghostMeshBatch: GhostMeshBatchRenderer | null = null
let levelMeshRenderer: GhostLevelMeshRenderer | null = null
let viewerMounted = false
let orthographicVertical = 45
const isometricCameraDirection = new THREE.Vector3(1, 1, 1).normalize()
const ragdollEuler = new THREE.Euler()
const ragdollQuaternion = new THREE.Quaternion()
const ragdollMatrix = new THREE.Matrix4()

const activeCamera = () =>
	props.cameraMode === 'isometric' ? orthographicCamera : perspectiveCamera

onMounted(() => {
	viewerMounted = true
	if (!createScene()) return
	createGhosts()
	animationFrame = requestAnimationFrame(renderLoop)
	void loadGhostSoapboxGeometries()
		.then((geometries) => {
			if (!viewerMounted) return
			ghostMeshBatch?.setModelGeometries(geometries)
			updateGhosts()
		})
		.catch(() => undefined)
})

watch(
	() => props.ghosts,
	() => {
		if (props.bulkMode) reconcileGhosts()
		else createGhosts()
	},
	{ deep: false },
)

watch(
	() => props.bulkMode,
	() => {
		createGhosts()
	},
)

watch(
	() => props.labelRecordIds,
	() => syncGhostLabels(),
	{ deep: false },
)

watch(
	() => props.sceneRevision,
	() => {
		if (props.bulkMode) reconcileGhosts()
		else createGhosts()
	},
)

watch(
	() => props.bulkGhostCount,
	() => {
		if (props.bulkMode) refreshBulkTrails()
	},
)

watch(
	() => props.levelBlocks,
	() => {
		if (props.bulkMode) createGhosts()
		else createLevelGeometry()
	},
	{ deep: false },
)

watch(
	() => props.showLevelGeometry,
	() => createLevelGeometry(),
)

watch(
	() => props.showGhostTrails,
	() => syncGhostTrailVisibility(),
)

watch(
	() => props.cameraMode,
	() => configureControls(),
)

watch(
	() => props.selectedRecordId,
	() => updateSelection(),
)

watch(
	() => props.quality,
	() => {
		configureRendererQuality()
		if (props.bulkMode) refreshBulkTrails()
		resize()
	},
)

onBeforeUnmount(() => {
	viewerMounted = false
	disposeScene()
})

function createScene() {
	const host = canvasHost.value
	const labels = labelHost.value
	if (!host || !labels) return false
	const antialias = props.quality !== 'performance'
	try {
		renderer = new THREE.WebGLRenderer({
			antialias,
			alpha: true,
			powerPreference: 'high-performance',
		})
	} catch {
		rendererError.value = true
		return false
	}
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.shadowMap.enabled = props.quality === 'quality'
	renderer.domElement.addEventListener('webglcontextlost', onContextLost)
	renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)
	host.replaceChildren(renderer.domElement)

	labelRenderer = new CSS2DRenderer({ element: labels })
	labelRenderer.setSize(host.clientWidth, host.clientHeight)

	scene = new THREE.Scene()
	ghostMeshBatch = new GhostMeshBatchRenderer(scene)
	levelMeshRenderer = new GhostLevelMeshRenderer(
		scene,
		{ baseUrl: String(config.public.blockMeshBaseUrl ?? '') },
		resolveCssColor('--ui-text-muted', '#a8a29e'),
	)
	orbitFog = new THREE.Fog(resolveCssColor('--ui-bg', '#0c0a09'), 350, 1_500)
	scene.fog = orbitFog
	scene.add(new THREE.HemisphereLight(0xffffff, 0x292524, 2.1))
	const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
	keyLight.position.set(80, 120, 40)
	keyLight.castShadow = props.quality === 'quality'
	scene.add(keyLight)

	perspectiveCamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 5_000)
	perspectiveCamera.position.set(35, 24, 35)
	orthographicCamera = new THREE.OrthographicCamera(-40, 40, 22.5, -22.5, 0.1, 5_000)
	orthographicCamera.position.set(70, 70, 70)
	orthographicCamera.lookAt(0, 0, 0)
	configureControls()
	configureRendererQuality()
	resizeObserver = new ResizeObserver(resize)
	resizeObserver.observe(host)
	resize()
	return true
}

function configureControls() {
	controls?.dispose()
	const camera = activeCamera()
	const canvas = renderer?.domElement
	if (!camera || !canvas) return
	if (scene) scene.fog = props.cameraMode === 'isometric' ? null : orbitFog
	controls = new OrbitControls(camera, canvas)
	controls.enableDamping = true
	controls.dampingFactor = 0.08
	controls.maxDistance = 1_200
	controls.enablePan = true
	controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
	controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
	if (props.cameraMode === 'isometric') {
		controls.enableRotate = false
		controls.screenSpacePanning = true
		controls.mouseButtons.LEFT = THREE.MOUSE.PAN
		controls.addEventListener('start', detachIsometricFollow)
	} else {
		controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
	}
	frameSelected()
}

function detachIsometricFollow() {
	if (props.cameraMode === 'isometric' && props.following) emit('update:following', false)
}

function configureRendererQuality() {
	if (!renderer) return
	const maximumDpr = props.quality === 'performance' ? 1 : props.quality === 'balanced' ? 1.5 : 2
	renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, maximumDpr))
	renderer.shadowMap.enabled = props.quality === 'quality'
}

function createGhosts() {
	if (!scene) return
	for (const visual of visuals.values()) disposeVisual(visual)
	visuals.clear()
	removeNamedObject('ghost-grid')
	grid = buildSceneGrid()
	createGrid(grid)
	createLevelGeometry()

	for (const [visualIndex, loaded] of props.ghosts.entries()) {
		addGhostVisual(loaded, visualIndex)
	}
	configureGhostMeshes()
	updateSelection()
	resize()
	frameRoute()
}

function buildSceneGrid() {
	if (props.bulkMode) {
		if (props.levelBlocks.length > 0) {
			return buildGhostGrid([
				props.levelBlocks.map((block, index) => ({ time: index, position: block.position })),
			])
		}
		const first = props.ghosts[0]
		return buildGhostGrid(first ? [resolveDisplayFrames(first)] : [])
	}
	return buildGhostGrid(props.ghosts.map(resolveDisplayFrames))
}

function resolveDisplayFrames({ ghost }: LoadedPlaybackGhost) {
	return ghost.frames.map((frame) => ({
		...frame,
		position: resolveGhostDisplayPosition(frame),
	}))
}

function reconcileGhosts() {
	if (!scene) return
	if (!grid) {
		grid = buildSceneGrid()
		createGrid(grid)
		createLevelGeometry()
	}
	const desired = props.ghosts.map((loaded) => ({
		recordId: loaded.record.recordId,
		revision: visualRevision(loaded),
	}))
	const reconciliation = planGhostVisualReconciliation(
		[...visuals.values()].map((visual) => ({
			recordId: visual.ghost.record.recordId,
			revision: visual.revision,
		})),
		desired,
	)
	for (const recordId of reconciliation.remove) {
		const visual = visuals.get(recordId)
		if (!visual) continue
		disposeVisual(visual)
		visuals.delete(recordId)
	}
	const desiredCreates = new Set(reconciliation.create.map(({ recordId }) => recordId))
	for (const [visualIndex, loaded] of props.ghosts.entries()) {
		if (desiredCreates.has(loaded.record.recordId)) addGhostVisual(loaded, visualIndex)
		else {
			const visual = visuals.get(loaded.record.recordId)
			if (visual) visual.labelStagger = visualIndex % 4
		}
	}
	configureGhostMeshes()
	syncGhostLabels()
	updateSelection()
	resize()
}

function addGhostVisual(loaded: LoadedPlaybackGhost, visualIndex: number) {
	if (!scene) return
	const group = new THREE.Group()
	group.name = `ghost-${loaded.record.recordId}`
	const label = isLabeledGhost(loaded.record.recordId) ? createGhostLabel(loaded) : null
	const labelObject = label ? new CSS2DObject(label) : null
	labelObject?.position.set(0, 2.8, 0)

	const { trail, geometry, material, times } = createTrail(loaded)
	scene.add(trail)
	if (labelObject) scene.add(labelObject)
	visuals.set(loaded.record.recordId, {
		ghost: loaded,
		revision: visualRevision(loaded),
		group,
		label,
		labelObject,
		labelStagger: visualIndex % 4,
		trail,
		trailGeometry: geometry,
		trailMaterial: material,
		trailTimes: times,
	})
}

function configureGhostMeshes() {
	const descriptors: GhostMeshDescriptor[] = props.ghosts.map(({ record, identity }) => ({
		recordId: record.recordId,
		bodyColor: identity.bodyColor,
		isWorldRecord: identity.isWorldRecord,
	}))
	ghostMeshBatch?.configure(descriptors)
}

function refreshBulkTrails() {
	if (!scene || !grid) return
	for (const visual of visuals.values()) {
		visual.trailGeometry.dispose()
		visual.trailMaterial.dispose()
		scene.remove(visual.trail)
		const { trail, geometry, material, times } = createTrail(visual.ghost)
		visual.trail = trail
		visual.trailGeometry = geometry
		visual.trailMaterial = material
		visual.trailTimes = times
		scene.add(trail)
	}
	resize()
}

function createGhostLabel(loaded: LoadedPlaybackGhost) {
	const label = document.createElement('div')
	label.className =
		'pointer-events-none whitespace-nowrap rounded-md border bg-default/90 px-2 py-1 text-xs font-bold text-highlighted shadow-sm backdrop-blur'
	label.textContent = loaded.identity.label
	label.style.borderColor = loaded.identity.bodyColor
	return label
}

function isLabeledGhost(recordId: number) {
	return props.labelRecordIds === undefined || props.labelRecordIds.includes(recordId)
}

function syncGhostLabels() {
	if (!scene) return
	for (const visual of visuals.values()) {
		const shouldLabel = isLabeledGhost(visual.ghost.record.recordId)
		if (shouldLabel && !visual.label) {
			visual.label = createGhostLabel(visual.ghost)
			visual.labelObject = new CSS2DObject(visual.label)
			visual.labelObject.position.set(0, 2.8, 0)
			scene.add(visual.labelObject)
		} else if (!shouldLabel && visual.label) {
			visual.label.remove()
			if (visual.labelObject) scene.remove(visual.labelObject)
			visual.label = null
			visual.labelObject = null
		}
	}
}

function visualRevision(loaded: LoadedPlaybackGhost) {
	return [
		loaded.record.mediaRevision ?? '',
		loaded.ghost.version,
		loaded.ghost.frames.length,
		loaded.identity.label,
		loaded.identity.bodyColor,
		loaded.identity.isWorldRecord,
		loaded.identity.userRunOrdinal ?? '',
	].join(':')
}

function createLevelGeometry() {
	if (!props.showLevelGeometry) {
		levelMeshRenderer?.clear()
		return
	}
	if (!grid) return
	void levelMeshRenderer?.render(props.levelBlocks, grid.origin)
}

function syncGhostTrailVisibility() {
	for (const visual of visuals.values()) {
		visual.trail.visible = props.showGhostTrails
		if (!props.showGhostTrails) visual.trailGeometry.instanceCount = 0
	}
	if (props.showGhostTrails) updateGhosts()
}

function createTrail(loaded: LoadedPlaybackGhost) {
	const ghostCount = props.bulkMode
		? Math.max(props.ghosts.length, props.bulkGhostCount ?? 0)
		: props.ghosts.length
	const maximum = resolveGhostTrailSampleLimit(props.quality, ghostCount, props.bulkMode)
	const positions: number[] = []
	const times: number[] = []
	for (const frame of sampleGhostTrailFrames(loaded.ghost.frames, maximum)) {
		if (!grid) continue
		const position = rebaseGhostPosition(resolveGhostDisplayPosition(frame), grid.origin)
		positions.push(position.x, position.y + 0.1, position.z)
		times.push(frame.time)
	}
	const geometry = new LineGeometry()
	geometry.setPositions(positions)
	const material = new LineMaterial({
		color: new THREE.Color(loaded.identity.bodyColor).getHex(),
		linewidth: loaded.identity.isWorldRecord ? 4 : 2.5,
		transparent: true,
		opacity: loaded.identity.isWorldRecord ? 0.9 : 0.65,
		dashed: (loaded.identity.userRunOrdinal ?? 0) > 1,
		dashSize: 5,
		gapSize: Math.min(8, 2 + (loaded.identity.userRunOrdinal ?? 0)),
	})
	const trail = new Line2(geometry, material)
	trail.visible = props.showGhostTrails
	trail.computeLineDistances()
	geometry.instanceCount = 0
	return { trail, geometry, material, times }
}

function createGrid(model: GhostGridModel) {
	if (!scene) return
	const group = new THREE.Group()
	group.name = 'ghost-grid'
	const minorColor = resolveCssColor('--ui-border', '#44403c')
	const primaryColor = resolveCssColor('--ui-primary', '#facc15')
	group.add(
		createGridLines(model.minorX, model.minimumZ, model.maximumZ, true, minorColor, 0.28),
		createGridLines(model.minorZ, model.minimumX, model.maximumX, false, minorColor, 0.28),
		createGridLines(model.majorX, model.minimumZ, model.maximumZ, true, primaryColor, 0.3),
		createGridLines(model.majorZ, model.minimumX, model.maximumX, false, primaryColor, 0.3),
	)
	scene.add(group)
}

function createGridLines(
	values: number[],
	minimum: number,
	maximum: number,
	xAxis: boolean,
	color: string,
	opacity: number,
) {
	const positions: number[] = []
	for (const value of values) {
		positions.push(
			xAxis ? value : minimum,
			0,
			xAxis ? minimum : value,
			xAxis ? value : maximum,
			0,
			xAxis ? maximum : value,
		)
	}
	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	return new THREE.LineSegments(
		geometry,
		new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
	)
}

function renderLoop(timestamp: number) {
	animationFrame = requestAnimationFrame(renderLoop)
	const interval = 1_000 / props.frameRate
	if (timestamp - lastRenderedAt < interval) return
	const delta = Math.min(0.1, lastPlaybackAt > 0 ? (timestamp - lastPlaybackAt) / 1_000 : 0)
	lastPlaybackAt = timestamp
	lastRenderedAt = timestamp
	if (props.playing) {
		const duration = Math.max(0, ...props.ghosts.map(({ record }) => record.time))
		const next = props.currentTime + delta * props.playbackRate
		if (next >= duration) {
			emit('update:currentTime', props.loop ? 0 : duration)
			if (!props.loop) emit('update:playing', false)
		} else emit('update:currentTime', next)
	}
	updateGhosts()
	controls?.update()
	const camera = activeCamera()
	if (!renderer || !labelRenderer || !scene || !camera || contextLost.value) return
	renderer.render(scene, camera)
	labelRenderer.render(scene, camera)
	recordRenderedFrame(timestamp)
}

function recordRenderedFrame(timestamp: number) {
	if (frameRateWindowStartedAt === 0) {
		frameRateWindowStartedAt = timestamp
		return
	}
	renderedFrameCount += 1
	const elapsed = timestamp - frameRateWindowStartedAt
	if (elapsed < 500) return
	currentFrameRate.value = Math.max(0, Math.round((renderedFrameCount * 1_000) / elapsed))
	frameRateWindowStartedAt = timestamp
	renderedFrameCount = 0
}

function updateGhosts() {
	if (!grid) return
	let selectedDelta: THREE.Vector3 | null = null
	ghostMeshBatch?.beginFrame()
	for (const visual of visuals.values()) {
		const frame = interpolateGhostFrame(visual.ghost.ghost.frames, props.currentTime)
		if (!frame) {
			ghostMeshBatch?.hide(visual.ghost.record.recordId)
			continue
		}
		const ragdollActive = frame.ragdoll === true
		const next = rebaseGhostPosition(resolveGhostDisplayPosition(frame), grid.origin)
		const previous = visual.group.position.clone()
		visual.group.position.set(next.x, next.y, next.z)
		if (visual.label && visual.labelObject) updateLabelPosition(visual, next)
		if (ragdollActive) visual.group.quaternion.identity()
		else if (frame.orientation) {
			visual.group.quaternion.set(
				-frame.orientation.x,
				-frame.orientation.y,
				frame.orientation.z,
				frame.orientation.w,
			)
		}
		visual.group.updateMatrix()
		let currentRagdollMatrix: THREE.Matrix4 | null = null
		if (ragdollActive) {
			if (frame.ragdollRotation) {
				ragdollEuler.set(
					THREE.MathUtils.degToRad(-frame.ragdollRotation.x),
					THREE.MathUtils.degToRad(-frame.ragdollRotation.y),
					THREE.MathUtils.degToRad(frame.ragdollRotation.z),
				)
				ragdollQuaternion.setFromEuler(ragdollEuler)
			} else ragdollQuaternion.identity()
			ragdollMatrix.compose(
				visual.group.position,
				ragdollQuaternion,
				visual.group.scale,
			)
			currentRagdollMatrix = ragdollMatrix
		}
		ghostMeshBatch?.update(visual.ghost.record.recordId, {
			worldMatrix: visual.group.matrix,
			position: visual.group.position,
			ragdoll: ragdollActive,
			ragdollMatrix: currentRagdollMatrix,
			braking: frame.braking === true,
			paraglider: frame.paraglider === true,
			wheelState: frame.wheelState,
			wheelColor: resolveGhostWheelColor(frame),
		})
		if (props.showGhostTrails) {
			const segments = upperBound(visual.trailTimes, props.currentTime)
			visual.trailGeometry.instanceCount = Math.max(0, segments - 1)
		} else visual.trailGeometry.instanceCount = 0
		if (visual.ghost.record.recordId === props.selectedRecordId) {
			selectedDelta = visual.group.position.clone().sub(previous)
		}
	}
	ghostMeshBatch?.commitFrame()
	if (props.following && selectedDelta && controls && activeCamera()) {
		activeCamera()?.position.add(selectedDelta)
		controls.target.add(selectedDelta)
	}
}

function updateLabelPosition(visual: GhostVisual, position: { x: number; y: number; z: number }) {
	const camera = activeCamera()
	const host = canvasHost.value
	if (!camera || !host || !visual.label || !visual.labelObject) return
	const viewportHeight = Math.max(1, host.clientHeight)
	const worldUnitsPerPixel =
		camera instanceof THREE.PerspectiveCamera
			? perspectiveWorldUnitsPerPixel(
				camera.position.distanceTo(visual.group.position),
				camera.fov,
				viewportHeight,
			)
			: orthographicWorldUnitsPerPixel(
				camera.top - camera.bottom,
				camera.zoom,
				viewportHeight,
			)
	const offset = calculateGhostLabelWorldOffset(
		worldUnitsPerPixel,
		visual.label.offsetHeight,
		visual.labelStagger,
	)
	visual.labelObject.position.set(position.x, position.y + offset, position.z)
}

function updateSelection() {
	for (const visual of visuals.values()) {
		const selected = visual.ghost.record.recordId === props.selectedRecordId
		visual.group.scale.setScalar(selected ? 1.08 : 1)
		if (visual.label) {
			visual.label.style.zIndex = selected ? '3' : visual.ghost.identity.isWorldRecord ? '2' : '1'
			visual.label.style.boxShadow = selected
				? `0 0 0 2px ${visual.ghost.identity.bodyColor}`
				: ''
		}
	}
}

function followSelected() {
	emit('update:following', true)
	frameSelected()
}

function frameSelected() {
	const selected = visuals.get(props.selectedRecordId ?? -1)
	const camera = activeCamera()
	if (!selected || !camera || !controls) return
	const target = selected.group.position.clone()
	controls.target.copy(target)
	if (props.cameraMode === 'isometric') {
		orthographicVertical = 45
		resize()
		positionIsometricCamera(target)
	}
	else camera.position.copy(target).add(new THREE.Vector3(16, 10, 16))
	controls.update()
}

function frameRoute() {
	if (!grid || !controls) return
	const camera = activeCamera()
	if (!camera) return
	const width = grid.maximumX - grid.minimumX
	const depth = grid.maximumZ - grid.minimumZ
	const distance = Math.max(width, depth, 80)
	controls.target.set(0, 0, 0)
	if (camera instanceof THREE.PerspectiveCamera) camera.position.set(distance * 0.55, distance * 0.4, distance * 0.55)
	else {
		const host = canvasHost.value
		const aspect = host ? Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight) : 16 / 9
		const routeHeight = grid.routeMaximum.y - grid.routeMinimum.y
		const projectedVertical = (width + 2 * routeHeight + depth) / Math.sqrt(6)
		orthographicVertical = Math.max(depth, width / aspect, projectedVertical, 80) * 1.2
		const target = new THREE.Vector3(
			(grid.routeMinimum.x + grid.routeMaximum.x) / 2,
			(grid.routeMinimum.y + grid.routeMaximum.y) / 2,
			(grid.routeMinimum.z + grid.routeMaximum.z) / 2,
		)
		controls.target.copy(target)
		resize()
		positionIsometricCamera(target)
	}
	controls.update()
}

function positionIsometricCamera(target: THREE.Vector3) {
	if (!orthographicCamera || !grid) return
	const { distance, far } = calculateIsometricCameraDepth(grid)
	orthographicCamera.position.copy(target).addScaledVector(isometricCameraDirection, distance)
	orthographicCamera.far = far
	orthographicCamera.updateProjectionMatrix()
	if (controls) controls.maxDistance = Math.max(1_200, distance * 2)
}

function resize() {
	const host = canvasHost.value
	if (!host || !renderer || !labelRenderer || !perspectiveCamera || !orthographicCamera) return
	const width = Math.max(1, host.clientWidth)
	const height = Math.max(1, host.clientHeight)
	const aspect = width / height
	perspectiveCamera.aspect = aspect
	perspectiveCamera.updateProjectionMatrix()
	const vertical = orthographicVertical
	orthographicCamera.left = (-vertical * aspect) / 2
	orthographicCamera.right = (vertical * aspect) / 2
	orthographicCamera.top = vertical / 2
	orthographicCamera.bottom = -vertical / 2
	orthographicCamera.updateProjectionMatrix()
	renderer.setSize(width, height, false)
	labelRenderer.setSize(width, height)
	for (const visual of visuals.values()) visual.trailMaterial.resolution.set(width, height)
}

function removeNamedObject(name: string) {
	const object = scene?.getObjectByName(name)
	if (!object || !scene) return
	object.traverse(disposeObject)
	scene.remove(object)
}

function disposeVisual(visual: GhostVisual) {
	visual.trailGeometry.dispose()
	visual.trailMaterial.dispose()
	visual.label?.remove()
	scene?.remove(visual.trail)
	if (visual.labelObject) scene?.remove(visual.labelObject)
}

function disposeObject(object: THREE.Object3D) {
	if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
		object.geometry.dispose()
		const materials = Array.isArray(object.material) ? object.material : [object.material]
		for (const material of materials) material.dispose()
	}
}

function disposeScene() {
	cancelAnimationFrame(animationFrame)
	resizeObserver?.disconnect()
	controls?.dispose()
	for (const visual of visuals.values()) disposeVisual(visual)
	visuals.clear()
	ghostMeshBatch?.dispose()
	ghostMeshBatch = null
	levelMeshRenderer?.dispose()
	levelMeshRenderer = null
	if (scene) scene.traverse(disposeObject)
	renderer?.domElement.removeEventListener('webglcontextlost', onContextLost)
	renderer?.domElement.removeEventListener('webglcontextrestored', onContextRestored)
	renderer?.dispose()
	renderer?.domElement.remove()
	labelHost.value?.replaceChildren()
}

function onContextLost(event: Event) {
	event.preventDefault()
	contextLost.value = true
}

function onContextRestored() {
	contextLost.value = false
	createGhosts()
}

function resolveCssColor(variable: string, fallback: string) {
	const probe = document.createElement('span')
	probe.style.color = `var(${variable})`
	probe.style.display = 'none'
	document.body.append(probe)
	const value = getComputedStyle(probe).color || fallback
	probe.remove()
	return value
}

function upperBound(values: readonly number[], target: number) {
	let low = 0
	let high = values.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if ((values[middle] ?? Number.POSITIVE_INFINITY) <= target) low = middle + 1
		else high = middle
	}
	return low
}

defineExpose({ frameRoute, followSelected, frameSelected })
</script>

<style>
.ghost-viewer canvas {
	display: block;
	width: 100%;
	height: 100%;
}
</style>
