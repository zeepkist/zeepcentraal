import { createHash } from 'node:crypto'
import { countCheckpoints, countFinishes } from './metadata'
import {
	type CsvBlock,
	levelFormat,
	type ParsedLevel,
	type ParsedLevelV2,
	type Vector3,
} from './types'
import {
	compareNumber,
	integerOrDefault,
	medalTime,
	numberOrDefault,
	presentBlockId,
} from './utils'
import { xxHash128Hex } from './xxhash'

interface ParsedCsvBlock extends CsvBlock {
	rawEuler: [string, string, string]
	rawPosition: [string, string, string]
	rawScale: [string, string, string]
}

function formatDecimal(value: string): string {
	const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
	if (!match) {
		return '0'
	}
	const sign = match[1] === '-' ? '-' : ''
	const integer = match[2] ?? ''
	const fraction = match[3] ?? ''
	const exponent = Number(match[4] ?? 0)
	const digits = `${integer}${fraction}`
	const decimalIndex = integer.length + exponent
	const expanded =
		decimalIndex <= 0
			? `0.${'0'.repeat(-decimalIndex)}${digits}`
			: decimalIndex >= digits.length
				? `${digits}${'0'.repeat(decimalIndex - digits.length)}`
				: `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
	const [expandedInteger = '0', expandedFraction] = expanded.split('.')
	const normalizedInteger = expandedInteger.replace(/^0+(?=\d)/, '')
	const normalized =
		expandedFraction === undefined
			? normalizedInteger
			: `${normalizedInteger}.${expandedFraction}`
	return /^0(?:\.0*)?$/.test(normalized) ? normalized : `${sign}${normalized}`
}

function safeVector(values: string[], offset: number): Vector3 {
	return {
		X: numberOrDefault(values[offset]),
		Y: numberOrDefault(values[offset + 1]),
		Z: numberOrDefault(values[offset + 2]),
	}
}

function compareVector(left: Vector3, right: Vector3): number {
	return (
		compareNumber(left.X, right.X) ||
		compareNumber(left.Y, right.Y) ||
		compareNumber(left.Z, right.Z)
	)
}

function compareSequence(left: number[], right: number[]): number {
	const length = compareNumber(left.length, right.length)
	if (length !== 0) {
		return length
	}
	for (let index = 0; index < left.length; index++) {
		const comparison = compareNumber(left[index] ?? 0, right[index] ?? 0)
		if (comparison !== 0) {
			return comparison
		}
	}
	return 0
}

function compareBlocks(left: ParsedCsvBlock, right: ParsedCsvBlock): number {
	return (
		compareNumber(left.Id, right.Id) ||
		compareVector(left.Position, right.Position) ||
		compareVector(left.Euler, right.Euler) ||
		compareVector(left.Scale, right.Scale) ||
		compareSequence(left.Paints, right.Paints) ||
		compareSequence(left.Options, right.Options)
	)
}

function vectorText(values: [string, string, string]): string {
	return `<${values.join(',')}>`
}

function formatSingle(value: number): string {
	const formatted = Math.fround(value).toPrecision(7)
	if (!formatted.includes('e')) {
		return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
	}
	return formatted.replace(/(\.\d*?)0+e/i, '$1e').replace(/\.e/i, 'e')
}

function normalizeBlockValues(values: string[]): string[] {
	return [...values, ...Array.from({ length: 38 - values.length }, () => '0')]
}

function normalizeRow(values: string[], length: number): string[] {
	return [
		...values.slice(0, length),
		...Array.from({ length: Math.max(0, length - values.length) }, () => '0'),
	]
}

function parseCsvContent(content: string): {
	first: string[]
	camera: string[]
	validation: string[]
	blockLines: string[]
} {
	const lines = content.split(/\r?\n/)
	const first = normalizeRow((lines[0] ?? '').split(','), 3)
	const camera = normalizeRow((lines[1] ?? '').split(','), 8)
	const rawValidation = (lines[2] ?? '').split(',')
	const validationIsBlock = rawValidation.length >= 10
	const validation = validationIsBlock
		? ['0', '0', '0', '0', '0', '0']
		: normalizeRow(rawValidation, 6)
	const blockLines = validationIsBlock ? lines.slice(2) : lines.slice(3)
	return { first, camera, validation, blockLines }
}

function blockText(block: ParsedCsvBlock): string {
	return `Id: ${block.Id}, Position: ${vectorText(block.rawPosition)}, Euler: ${vectorText(block.rawEuler)}, Scale: ${vectorText(block.rawScale)}, Paints: ${block.Paints.join(', ')}, Options: ${block.Options.map(formatSingle).join(', ')}`
}

function canonicalCsvContent(
	skybox: number,
	ground: number,
	blocks: ParsedCsvBlock[],
	formatBlock = blockText,
): string {
	const ordered = blocks
		.filter((block) => block.Id !== presentBlockId)
		.map((block, index) => ({ block, index }))
		.sort((left, right) => compareBlocks(left.block, right.block) || left.index - right.index)
		.map(({ block }) => block)
	return [`${skybox}`, `${ground}`, ...ordered.map(formatBlock), ''].join('\r\n')
}

function calculateHash(skybox: number, ground: number, blocks: ParsedCsvBlock[]): string {
	return createHash('sha1')
		.update(canonicalCsvContent(skybox, ground, blocks), 'utf8')
		.digest('hex')
		.toUpperCase()
}

function parseCsvBlocksForHash(lines: string[]): ParsedCsvBlock[] {
	const blocks: ParsedCsvBlock[] = []
	for (const line of lines) {
		if (!line.trim()) {
			continue
		}
		const values = normalizeBlockValues(line.split(','))
		const id = integerOrDefault(values[0])
		const rawPaints = values.slice(10, 27)
		const paints = rawPaints.map((value) => {
			const parsed = numberOrDefault(value)
			return id === 2279 ? Math.trunc(Math.fround(parsed)) : Math.trunc(parsed)
		})
		const rawOptions = values.slice(27)
		blocks.push({
			Id: id,
			Position: safeVector(values, 1),
			Euler: safeVector(values, 4),
			Scale: safeVector(values, 7),
			Paints: paints,
			Options: rawOptions.map((value) => Math.fround(numberOrDefault(value))),
			rawPosition: values.slice(1, 4).map(formatDecimal) as [string, string, string],
			rawEuler: values.slice(4, 7).map(formatDecimal) as [string, string, string],
			rawScale: values.slice(7, 10).map(formatDecimal) as [string, string, string],
		})
	}
	return blocks
}

export function calculateCsvLevelXxHash(content: string): string {
	const { validation, blockLines } = parseCsvContent(content)
	const skybox = integerOrDefault(validation[4])
	const ground = integerOrDefault(validation[5])
	return xxHash128Hex(canonicalCsvContent(skybox, ground, parseCsvBlocksForHash(blockLines)))
}

function calculateCsvLegacyHash(content: string): string {
	const { validation, blockLines } = parseCsvContent(content)
	const skybox = integerOrDefault(validation[4])
	const ground = integerOrDefault(validation[5])
	return calculateHash(skybox, ground, parseCsvBlocksForHash(blockLines))
}

function parseCsvBlocksForMetadata(lines: string[]): ParsedCsvBlock[] {
	const blocks: ParsedCsvBlock[] = []
	for (const line of lines) {
		if (!line.trim()) {
			continue
		}
		const values = normalizeBlockValues(line.split(','))
		const id = integerOrDefault(values[0])
		const rawPaints = values.slice(10, 27)
		const paints = rawPaints.map((value) => {
			const parsed = numberOrDefault(value)
			return id === 2279 ? Math.trunc(Math.fround(parsed)) : Math.trunc(parsed)
		})
		const rawOptions = values.slice(27)
		blocks.push({
			Id: id,
			Position: safeVector(values, 1),
			Euler: safeVector(values, 4),
			Scale: safeVector(values, 7),
			Paints: paints,
			Options: rawOptions.map((value) => Math.fround(numberOrDefault(value))),
			rawPosition: values.slice(1, 4).map((value) => `${numberOrDefault(value)}`) as [
				string,
				string,
				string,
			],
			rawEuler: values.slice(4, 7).map((value) => `${numberOrDefault(value)}`) as [
				string,
				string,
				string,
			],
			rawScale: values.slice(7, 10).map((value) => `${numberOrDefault(value)}`) as [
				string,
				string,
				string,
			],
		})
	}
	return blocks
}

export function parseCsvLevel(content: string, adventure = false, authorId = 0n): ParsedLevel {
	const { first, camera, validation, blockLines } = parseCsvContent(content)

	const uid = first[2] ?? ''
	for (let index = 0; index < camera.length; index++) {
		numberOrDefault(camera[index])
	}

	const validationTime = medalTime(validation[0])
	const gold = medalTime(validation[1])
	const silver = medalTime(validation[2])
	const bronze = medalTime(validation[3])
	const skybox = integerOrDefault(validation[4])
	const ground = integerOrDefault(validation[5])

	const blocks = parseCsvBlocksForMetadata(blockLines)

	const metadataBlocks = blocks.map((block) => ({
		id: block.Id,
		isCheckpoint: (block.Options[5] ?? 0) >= 0.5,
	}))
	const zeepHash = adventure
		? uid
		: (() => {
				try {
					return calculateCsvLegacyHash(content)
				} catch {
					return uid
				}
			})()
	return {
		format: levelFormat.csv,
		hash: zeepHash,
		uid,
		authorId,
		fileAuthor: first[1] ?? '',
		validationTimeAuthor: validationTime,
		validationTimeGold: gold,
		validationTimeSilver: silver,
		validationTimeBronze: bronze,
		amountCheckpoints: countCheckpoints(metadataBlocks),
		amountFinishes: countFinishes(metadataBlocks),
		amountBlocks: blocks.length,
		typeGround: ground,
		typeSkybox: skybox,
		blocks: blocks.map(({ rawPosition, rawEuler, rawScale, ...block }) => block),
	}
}

export function parseCsvLevelV2(content: string, adventure = false, authorId = 0n): ParsedLevelV2 {
	const parsed = parseCsvLevel(content, adventure, authorId)
	const hash = calculateCsvLevelXxHash(content)

	return {
		...parsed,
		hash,
		zeepHash: parsed.hash,
	}
}
