export const levelFormat = {
	csv: 0,
	json: 1,
} as const

export interface Vector3 {
	X: number
	Y: number
	Z: number
}

export interface CsvBlock {
	Id: number
	Position: Vector3
	Euler: Vector3
	Scale: Vector3
	Paints: number[]
	Options: number[]
}

export interface ParsedLevel {
	format: (typeof levelFormat)[keyof typeof levelFormat]
	hash: string
	uid: string
	authorId: bigint
	fileAuthor: string
	validationTimeAuthor: number
	validationTimeGold: number
	validationTimeSilver: number
	validationTimeBronze: number
	amountCheckpoints: number
	amountFinishes: number
	amountBlocks: number
	typeGround: number
	typeSkybox: number
	blocks: CsvBlock[] | unknown[]
}
