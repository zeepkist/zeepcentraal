export type GhostVector2 = { x: number; y: number }
export type GhostVector3 = { x: number; y: number; z: number }
export type GhostQuaternion = { x: number; y: number; z: number; w: number }

export type GhostPlaybackCapabilities = {
	inputs: boolean
	air: boolean
	wheels: boolean
	slip: boolean
	state: boolean
	surfaces: boolean
	velocity: boolean
	ragdoll: boolean
	orientation: boolean
}

export type GhostPlaybackMetadata = {
	steamId: string | null
	taggedUsername: string | null
	color: string | null
	cosmetics: {
		zeepkist: number | null
		frontWheels: number | null
		rearWheels: number | null
		paraglider: number | null
		horn: number | null
		hat: number | null
		glasses: number | null
		colorBody: number | null
		colorLeftArm: number | null
		colorRightArm: number | null
		colorLeftLeg: number | null
		colorRightLeg: number | null
		color: number | null
	} | null
}

export type GhostPlaybackFrame = {
	time: number
	position: GhostVector3
	orientation?: GhostQuaternion
	speed?: number
	steering?: number
	armsUp?: boolean
	braking?: boolean
	horn?: boolean
	soap?: boolean
	offroad?: boolean
	paraglider?: boolean
	inAir?: boolean
	groundedWheelState?: number
	slippingWheelState?: number
	surfaceState?: number
	localVelocity?: GhostVector3
	localAngularVelocity?: GhostVector3
	localGForce?: GhostVector2
	parkingBlock?: boolean
	monorail?: boolean
	ragdoll?: boolean
	ragdollPosition?: GhostVector3
	ragdollRotation?: GhostVector3
}

export type GhostParseProgress = 'queued' | 'decompressing' | 'decoding' | 'complete'

export type GhostLoadState =
	| { status: 'idle' }
	| { status: 'loading'; progress: GhostParseProgress; source: 'cache' | 'network' | null }
	| { status: 'loaded'; source: 'cache' | 'network'; byteLength: number }
	| { status: 'error'; message: string }

export type ParsedPlaybackGhost = {
	version: number
	metadata: GhostPlaybackMetadata
	capabilities: GhostPlaybackCapabilities
	frames: GhostPlaybackFrame[]
}

export type GhostRecordSource = {
	recordId: number
	levelId: number
	userId: number
	userSteamId: string | null
	userName: string | null
	time: number
	dateCreated: string
	ghostUrl: string | null
	mediaRevision: string | null
	isWorldRecord: boolean
	isPersonalBest: boolean
}

export type GhostVisualIdentity = {
	recordId: number
	userKey: string
	playerName: string
	label: string
	isWorldRecord: boolean
	isPersonalBest: boolean
	userRunOrdinal: number | null
	bodyColor: string
	colorSource: 'world-record' | 'ghost' | 'fallback'
}

export type LoadedPlaybackGhost = {
	record: GhostRecordSource
	ghost: ParsedPlaybackGhost
	identity: GhostVisualIdentity
}

export type GhostCameraMode = 'orbit' | 'isometric'
export type GhostFrameRate = 'auto' | 30 | 60
export type GhostRenderQuality = 'auto' | 'performance' | 'balanced' | 'quality'

export type GhostPerformancePreferences = {
	version: 1
	frameRate: GhostFrameRate
	renderQuality: GhostRenderQuality
}

export type GhostGridModel = {
	cellSize: 16
	majorEvery: 4
	origin: GhostVector3
	minimumX: number
	maximumX: number
	minimumZ: number
	maximumZ: number
	minorX: number[]
	minorZ: number[]
	majorX: number[]
	majorZ: number[]
}

export type GhostLevelBlock = {
	id: number | null
	position: GhostVector3
	rotation: GhostVector3
	scale: GhostVector3
}

export type GhostEventKind =
	| 'arms-up'
	| 'braking'
	| 'horn'
	| 'paraglider'
	| 'soap'
	| 'offroad'
	| 'airborne'
	| 'slipping'
	| 'ragdoll'
	| 'parking'
	| 'monorail'

export type GhostTimelineEvent = {
	id: string
	kind: GhostEventKind
	start: number
	end: number
	duration: number
	startFrame: number
	endFrame: number
}

export type GhostSlipEvent = {
	id: string
	start: number
	end: number
	duration: number
	distance: number
	entrySpeed: number | null
	exitSpeed: number | null
	maximumSpeed: number | null
	speedRetention: number | null
	wheelState: number
	averageSteering: number | null
	peakSteering: number | null
}
