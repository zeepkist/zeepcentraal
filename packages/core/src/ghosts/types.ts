import type { KnownSurface } from './surfaceState'

export type Vector2 = { x: number; y: number }
export type Vector3 = { x: number; y: number; z: number }
export type Quaternion = { x: number; y: number; z: number; w: number }

export type GhostCosmetics = {
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
}

export type GhostMetadata = {
	steamId: string | null
	taggedUsername: string | null
	color: string | null
	cosmetics: GhostCosmetics | null
}

export type GhostCapabilities = {
	input: boolean
	air: boolean
	wheels: boolean
	slipping: boolean
	state: boolean
	surfaces: boolean
	velocity: boolean
	ragdoll: boolean
	orientation: boolean
}

export type GhostFrame = {
	time: number
	position: Vector3
	rotation?: Vector3
	orientation?: Quaternion
	speed?: number
	steering?: number
	armsUp?: boolean
	braking?: boolean
	horn?: boolean
	soap?: boolean
	offroad?: boolean
	paraglider?: boolean
	inAir?: boolean
	surface?: string
	surfaces?: KnownSurface[]
	wheelState?: number
	groundedWheelState?: number
	slippingWheelState?: number
	surfaceState?: number
	localVelocity?: Vector3
	localAngularVelocity?: Vector3
	localGForce?: Vector2
	parkingBlock?: boolean
	monorail?: boolean
	ragdoll?: boolean
	ragdollPosition?: Vector3
	ragdollRotation?: Vector3
}

export type GhostStatisticValues = {
	ghostVersion: number | null
	hasInputData: boolean
	hasAirData: boolean
	hasWheelData: boolean
	hasSlipData: boolean
	hasStateData: boolean
	hasSurfaceData: boolean
	hasVelocityData: boolean
	hasRagdollData: boolean
	frameCount: number | null
	time: number | null
	distance: number | null
	distanceInAir: number | null
	distanceOnGround: number | null
	distanceOn1Wheel: number | null
	distanceOn2Wheels: number | null
	distanceOn3Wheels: number | null
	distanceOn4Wheels: number | null
	timeInAir: number | null
	timeOnGround: number | null
	timeOn1Wheel: number | null
	timeOn2Wheels: number | null
	timeOn3Wheels: number | null
	timeOn4Wheels: number | null
	averageSpeed: number | null
	maxSpeed: number | null
	armsUpCount: number | null
	armsUpTime: number | null
	brakeCount: number | null
	brakeTime: number | null
	turnLeftCount: number | null
	turnLeftTime: number | null
	turnRightCount: number | null
	turnRightTime: number | null
	hornCount: number | null
	hornTime: number | null
	distanceSlipping: number | null
	distanceParaglider: number | null
	distanceOffroadWheels: number | null
	distanceSoapWheels: number | null
	distanceOnMonorail: number | null
	distanceParked: number | null
	distanceRagdoll: number | null
	timeSlipping: number | null
	timeParaglider: number | null
	timeOffroadWheels: number | null
	timeSoapWheels: number | null
	timeOnMonorail: number | null
	timeParked: number | null
	timeRagdoll: number | null
	distanceOnTarmac: number | null
	distanceOnGrass: number | null
	distanceOnSand: number | null
	distanceOnSnow: number | null
	distanceOnIce: number | null
	distanceOnSoap: number | null
	distanceOnMetal: number | null
	distanceOnWood: number | null
	distanceOnMud: number | null
	distanceOnFlesh: number | null
	timeOnTarmac: number | null
	timeOnGrass: number | null
	timeOnSand: number | null
	timeOnSnow: number | null
	timeOnIce: number | null
	timeOnSoap: number | null
	timeOnMetal: number | null
	timeOnWood: number | null
	timeOnMud: number | null
	timeOnFlesh: number | null
	averageVelocity: number | null
	maxVelocity: number | null
	averageAngularVelocity: number | null
	maxAngularVelocity: number | null
	averageGforce: number | null
	maxGforce: number | null
	timeAnyDriverInput: number | null
	driverInputTransitionCount: number | null
}

export type ParsedGhost = {
	version: number
	metadata: GhostMetadata
	capabilities: GhostCapabilities
	frames: GhostFrame[]
}
