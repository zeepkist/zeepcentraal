export const KNOWN_SURFACES = ['tarmac', 'grass', 'sand', 'snow', 'ice', 'soap', 'metal'] as const

export type KnownSurface = (typeof KNOWN_SURFACES)[number]

export type Vector3 = { x: number; y: number; z: number }

export type GhostFrame = {
	time: number
	position: Vector3
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
}

export type GhostStatisticValues = {
	frameCount: number | null
	duration: number | null
	distanceTravelled: number | null
	distanceInAir: number | null
	distanceOnGround: number | null
	timeInAir: number | null
	timeOnGround: number | null
	averageSpeed: number | null
	topSpeed: number | null
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
	soapTime: number | null
	offroadTime: number | null
	paragliderTime: number | null
	distanceOnTarmac: number | null
	distanceOnGrass: number | null
	distanceOnSand: number | null
	distanceOnSnow: number | null
	distanceOnIce: number | null
	distanceOnSoap: number | null
	distanceOnMetal: number | null
	timeOnTarmac: number | null
	timeOnGrass: number | null
	timeOnSand: number | null
	timeOnSnow: number | null
	timeOnIce: number | null
	timeOnSoap: number | null
	timeOnMetal: number | null
}

export type ParseStatisticsOptions = {
	deriveLegacy?: boolean
}

export type ParsedGhost = {
	version: number
	frames: GhostFrame[]
	statistics?: GhostStatisticValues
}
