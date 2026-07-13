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
	Euler: Vector3
	Id: number
	Options: number[]
	Paints: number[]
	Position: Vector3
	Scale: Vector3
}

export interface ParsedLevel {
	amountBlocks: number
	amountCheckpoints: number
	amountFinishes: number
	authorId: bigint
	blocks: CsvBlock[] | unknown[]
	fileAuthor: string
	format: (typeof levelFormat)[keyof typeof levelFormat]
	hash: string
	typeGround: number
	typeSkybox: number
	uid: string
	validationTimeAuthor: number
	validationTimeBronze: number
	validationTimeGold: number
	validationTimeSilver: number
}

export interface ParsedLevelV2 extends Omit<ParsedLevel, 'hash'> {
	hash: string
	zeepHash: string
}
