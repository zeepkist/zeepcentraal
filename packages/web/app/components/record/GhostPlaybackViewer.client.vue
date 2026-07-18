<template>
	<div
		ref="container"
		class="ghost-viewer relative aspect-video min-h-80 w-full overflow-hidden rounded-2xl border border-border bg-default shadow-sm"
	>
		<div ref="canvasHost" class="absolute inset-0" />
		<div ref="labelHost" class="pointer-events-none absolute inset-0 overflow-hidden" />
		<div class="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
			<UBadge color="neutral" variant="soft">{{ labels.frameRate(frameRate) }}</UBadge>
			<UBadge v-if="levelBlocks.length" color="neutral" variant="soft">
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

<script setup lang="ts">
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
import {
	buildGhostGrid,
	calculateGhostLabelWorldOffset,
	interpolateGhostFrame,
	orthographicWorldUnitsPerPixel,
	perspectiveWorldUnitsPerPixel,
	planGhostVisualReconciliation,
	rebaseGhostPosition,
	resolveGhostDisplayPosition,
	resolveGhostTrailSampleLimit,
	sampleGhostTrailFrames,
} from '~/utils/ghostScene'

type RenderQuality = 'performance' | 'balanced' | 'quality'

type GhostVisual = {
	ghost: LoadedPlaybackGhost
	detailed: boolean
	revision: string
	group: THREE.Group
	label: HTMLElement | null
	labelObject: CSS2DObject | null
	labelStagger: number
	trail: Line2
	trailGeometry: LineGeometry
	trailMaterial: LineMaterial
	trailTimes: number[]
	chassis: THREE.Mesh | null
	driver: THREE.Mesh | null
	arms: THREE.Mesh[]
	brakeLights: THREE.Mesh[]
	paraglider: THREE.Mesh | null
	ragdoll: THREE.Mesh | null
	wheels: THREE.Mesh[]
}

const props = withDefaults(defineProps<{
	ghosts: LoadedPlaybackGhost[]
	levelBlocks: GhostLevelBlock[]
	detailedRecordIds?: number[]
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
		frameRate: (value: number) => string
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
})

const emit = defineEmits<{
	'update:currentTime': [value: number]
	'update:playing': [value: boolean]
	'update:following': [value: boolean]
}>()

const container = useTemplateRef('container')
const canvasHost = useTemplateRef('canvasHost')
const labelHost = useTemplateRef('labelHost')
const contextLost = ref(false)
const rendererError = ref(false)

let renderer: THREE.WebGLRenderer | null = null
let labelRenderer: CSS2DRenderer | null = null
let scene: THREE.Scene | null = null
let perspectiveCamera: THREE.PerspectiveCamera | null = null
let orthographicCamera: THREE.OrthographicCamera | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let lastRenderedAt = 0
let lastPlaybackAt = 0
let grid: GhostGridModel | null = null
let visuals = new Map<number, GhostVisual>()
let orthographicVertical = 45

const activeCamera = () =>
	props.cameraMode === 'isometric' ? orthographicCamera : perspectiveCamera

onMounted(() => {
	if (!createScene()) return
	createGhosts()
	animationFrame = requestAnimationFrame(renderLoop)
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
	() => [props.bulkMode, props.detailedRecordIds] as const,
	() => {
		if (props.bulkMode) reconcileGhosts()
		else createGhosts()
	},
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

onBeforeUnmount(disposeScene)

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
	scene.fog = new THREE.Fog(resolveCssColor('--ui-bg', '#0c0a09'), 350, 1_500)
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
	controls = new OrbitControls(camera, canvas)
	controls.enableDamping = true
	controls.dampingFactor = 0.08
	controls.maxDistance = 1_200
	if (props.cameraMode === 'isometric') {
		controls.enableRotate = false
		controls.screenSpacePanning = true
		controls.mouseButtons.LEFT = THREE.MOUSE.PAN
		controls.addEventListener('start', detachIsometricFollow)
	} else {
		controls.enablePan = false
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
		detailed: isDetailedGhost(loaded.record.recordId),
		revision: visualRevision(loaded),
	}))
	const reconciliation = planGhostVisualReconciliation(
		[...visuals.values()].map((visual) => ({
			recordId: visual.ghost.record.recordId,
			detailed: visual.detailed,
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
	updateSelection()
	resize()
}

function addGhostVisual(loaded: LoadedPlaybackGhost, visualIndex: number) {
	if (!scene) return
	const detailed = isDetailedGhost(loaded.record.recordId)
	const soapbox = detailed ? createSoapbox(loaded) : createLightweightMarker(loaded)
	const { group } = soapbox
	const label = detailed ? createGhostLabel(loaded) : null
	const labelObject = label ? new CSS2DObject(label) : null
	labelObject?.position.set(0, 2.8, 0)

	const { trail, geometry, material, times } = createTrail(loaded)
	scene.add(group, trail)
	if (labelObject) scene.add(labelObject)
	visuals.set(loaded.record.recordId, {
		ghost: loaded,
		detailed,
		revision: visualRevision(loaded),
		group,
		label,
		labelObject,
		labelStagger: visualIndex % 4,
		trail,
		trailGeometry: geometry,
		trailMaterial: material,
		trailTimes: times,
		...soapbox,
	})
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

function isDetailedGhost(recordId: number) {
	return !props.bulkMode || props.detailedRecordIds === undefined || props.detailedRecordIds.includes(recordId)
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
	removeNamedObject('level-geometry')
	if (!scene || !grid || props.levelBlocks.length === 0) return
	const geometry = new THREE.BoxGeometry(2, 2, 2)
	const material = new THREE.MeshStandardMaterial({
		color: resolveCssColor('--ui-text-muted', '#a8a29e'),
		transparent: true,
		opacity: 0.2,
		roughness: 0.85,
		metalness: 0.05,
	})
	const mesh = new THREE.InstancedMesh(geometry, material, props.levelBlocks.length)
	mesh.name = 'level-geometry'
	const matrix = new THREE.Matrix4()
	const quaternion = new THREE.Quaternion()
	const position = new THREE.Vector3()
	const scale = new THREE.Vector3()
	const euler = new THREE.Euler()
	for (const [index, block] of props.levelBlocks.entries()) {
		const rebased = rebaseGhostPosition(block.position, grid.origin)
		position.set(rebased.x, rebased.y, rebased.z)
		euler.set(
			THREE.MathUtils.degToRad(-block.rotation.x),
			THREE.MathUtils.degToRad(-block.rotation.y),
			THREE.MathUtils.degToRad(block.rotation.z),
			'YXZ',
		)
		quaternion.setFromEuler(euler)
		scale.set(
			clampBlockScale(block.scale.x),
			clampBlockScale(block.scale.y),
			clampBlockScale(block.scale.z),
		)
		matrix.compose(position, quaternion, scale)
		mesh.setMatrixAt(index, matrix)
	}
	mesh.instanceMatrix.needsUpdate = true
	mesh.computeBoundingSphere()
	scene.add(mesh)
}

function createSoapbox(loaded: LoadedPlaybackGhost) {
	const group = new THREE.Group()
	group.name = `ghost-${loaded.record.recordId}`
	const color = new THREE.Color(loaded.identity.bodyColor)
	const material = new THREE.MeshStandardMaterial({
		color,
		transparent: true,
		opacity: loaded.identity.isWorldRecord ? 0.92 : 0.76,
		roughness: 0.42,
		metalness: 0.18,
	})
	const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.45, 2.5), material)
	chassis.position.y = 0.55
	group.add(chassis)
	const driver = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 5, 8), material.clone())
	driver.position.set(0, 1.35, 0.25)
	group.add(driver)
	const arms = [-1, 1].map((side) => {
		const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), material.clone())
		arm.position.set(side * 0.48, 1.45, 0.1)
		group.add(arm)
		return arm
	})
	const brakeLights = [-1, 1].map((side) => {
		const light = new THREE.Mesh(
			new THREE.BoxGeometry(0.28, 0.16, 0.08),
			new THREE.MeshBasicMaterial({ color: 0xef4444 }),
		)
		light.position.set(side * 0.48, 0.62, 1.28)
		light.visible = false
		group.add(light)
		return light
	})
	const paraglider = new THREE.Mesh(
		new THREE.SphereGeometry(2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
		new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
	)
	paraglider.position.set(0, 3.8, 0)
	paraglider.scale.y = 0.35
	paraglider.visible = false
	group.add(paraglider)
	const ragdoll = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 5, 8), material.clone())
	ragdoll.visible = false
	group.add(ragdoll)
	const wheels: THREE.Mesh[] = []
	for (const [x, z] of [
		[-0.82, -0.72],
		[0.82, -0.72],
		[-0.82, 0.82],
		[0.82, 0.82],
	] as const) {
		const wheel = new THREE.Mesh(
			new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12),
			new THREE.MeshStandardMaterial({ color: 0x171513, roughness: 0.8, transparent: true }),
		)
		wheel.rotation.z = Math.PI / 2
		wheel.position.set(x, 0.32, z)
		group.add(wheel)
		wheels.push(wheel)
	}
	return { group, chassis, driver, arms, brakeLights, paraglider, ragdoll, wheels }
}

function createLightweightMarker(loaded: LoadedPlaybackGhost) {
	const group = new THREE.Group()
	group.name = `ghost-${loaded.record.recordId}`
	const marker = new THREE.Mesh(
		new THREE.SphereGeometry(0.55, 8, 6),
		new THREE.MeshBasicMaterial({
			color: new THREE.Color(loaded.identity.bodyColor),
			transparent: true,
			opacity: loaded.identity.isWorldRecord ? 0.95 : 0.78,
		}),
	)
	marker.position.y = 0.55
	group.add(marker)
	return {
		group,
		chassis: null,
		driver: null,
		arms: [],
		brakeLights: [],
		paraglider: null,
		ragdoll: null,
		wheels: [],
	}
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
}

function updateGhosts() {
	if (!grid) return
	let selectedDelta: THREE.Vector3 | null = null
	for (const visual of visuals.values()) {
		const frame = interpolateGhostFrame(visual.ghost.ghost.frames, props.currentTime)
		if (!frame) continue
		const ragdollActive = frame.ragdoll === true
		const next = rebaseGhostPosition(resolveGhostDisplayPosition(frame), grid.origin)
		const previous = visual.group.position.clone()
		visual.group.position.set(next.x, next.y, next.z)
		if (visual.label && visual.labelObject) updateLabelPosition(visual, next)
		if (!visual.detailed) {
			if (frame.orientation) {
				visual.group.quaternion.set(
					-frame.orientation.x,
					-frame.orientation.y,
					frame.orientation.z,
					frame.orientation.w,
				)
			}
		} else if (ragdollActive) {
			visual.group.quaternion.identity()
		} else if (frame.orientation) {
			visual.group.quaternion.set(
				-frame.orientation.x,
				-frame.orientation.y,
				frame.orientation.z,
				frame.orientation.w,
			)
		}
		if (visual.chassis) visual.chassis.visible = !ragdollActive
		if (visual.driver) visual.driver.visible = !ragdollActive
		if (visual.ragdoll) {
			visual.ragdoll.visible = ragdollActive
			visual.ragdoll.position.set(0, 0, 0)
		}
		for (const [index, arm] of visual.arms.entries()) {
			arm.visible = !ragdollActive
			arm.rotation.z = frame.armsUp ? (index === 0 ? -1.15 : 1.15) : 0
		}
		for (const light of visual.brakeLights) {
			light.visible = !ragdollActive && frame.braking === true
		}
		if (visual.paraglider) visual.paraglider.visible = !ragdollActive && frame.paraglider === true
		if (ragdollActive && visual.ragdoll) {
			if (frame.ragdollRotation) {
				visual.ragdoll.rotation.set(
					THREE.MathUtils.degToRad(-frame.ragdollRotation.x),
					THREE.MathUtils.degToRad(-frame.ragdollRotation.y),
					THREE.MathUtils.degToRad(frame.ragdollRotation.z),
				)
			}
		}
		const wheelColor = frame.soap ? 0xec4899 : frame.offroad ? 0x84cc16 : 0x171513
		for (const [index, wheel] of visual.wheels.entries()) {
			wheel.visible = !ragdollActive
			const wheelMaterial = wheel.material as THREE.MeshStandardMaterial
			wheelMaterial.color.setHex(wheelColor)
			const grounded =
				frame.groundedWheelState === undefined ||
				(frame.groundedWheelState & (1 << index)) !== 0
			wheelMaterial.opacity = grounded ? 1 : 0.5
		}
		const segments = upperBound(visual.trailTimes, props.currentTime)
		visual.trailGeometry.instanceCount = Math.max(0, segments - 1)
		if (visual.ghost.record.recordId === props.selectedRecordId) {
			selectedDelta = visual.group.position.clone().sub(previous)
		}
	}
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
		camera.position.copy(target).add(new THREE.Vector3(45, 45, 45))
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
		orthographicVertical = Math.max(depth, width / aspect, 80) * 1.2
		resize()
		camera.position.set(distance * 0.5, distance * 0.5, distance * 0.5)
	}
	controls.update()
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
	visual.group.traverse(disposeObject)
	visual.trailGeometry.dispose()
	visual.trailMaterial.dispose()
	visual.label?.remove()
	scene?.remove(visual.group, visual.trail)
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

function clampBlockScale(value: number) {
	return Math.min(64, Math.max(0.2, Math.abs(value) * 2))
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
