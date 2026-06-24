import { createHash } from 'node:crypto'
import { countCheckpoints, countFinishes } from './metadata'
import { type CsvBlock, levelFormat, type ParsedLevel, type Vector3 } from './types'

const presentBlockId = 2264

interface ParsedCsvBlock extends CsvBlock {
	rawPosition: [string, string, string]
	rawEuler: [string, string, string]
	rawScale: [string, string, string]
}

function parseFinite(value: string, label: string): number {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid ${label}: ${value}`)
	}
	return parsed
}

function parseMedalTime(value: string | undefined): number {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

function formatDecimal(value: string): string {
	const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
	if (!match) {
		throw new Error(`Invalid decimal: ${value}`)
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

function vector(values: string[], offset: number, label: string): Vector3 {
	return {
		X: parseFinite(values[offset] ?? '', `${label}.x`),
		Y: parseFinite(values[offset + 1] ?? '', `${label}.y`),
		Z: parseFinite(values[offset + 2] ?? '', `${label}.z`),
	}
}

function compareNumber(left: number, right: number): number {
	return left < right ? -1 : left > right ? 1 : 0
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

function normalizeBlockValues(values: string[]): string[] {
	return [...values, ...Array.from({ length: 38 - values.length }, () => '0')]
}

function blockText(block: ParsedCsvBlock): string {
	return `Id: ${block.Id}, Position: ${vectorText(block.rawPosition)}, Euler: ${vectorText(block.rawEuler)}, Scale: ${vectorText(block.rawScale)}, Paints: ${block.Paints.join(', ')}, Options: ${block.Options.join(', ')}`
}

function calculateHash(skybox: number, ground: number, blocks: ParsedCsvBlock[]): string {
	const ordered = blocks
		.filter((block) => block.Id !== presentBlockId)
		.map((block, index) => ({ block, index }))
		.sort((left, right) => compareBlocks(left.block, right.block) || left.index - right.index)
		.map(({ block }) => block)
	const canonical = [`${skybox}`, `${ground}`, ...ordered.map(blockText), ''].join('\r\n')
	return createHash('sha1').update(canonical, 'utf8').digest('hex').toUpperCase()
}

export function parseCsvLevel(content: string, adventure = false, authorId = 0n): ParsedLevel {
	const lines = content.split(/\r?\n/)
	if (lines.length < 3) {
		throw new Error('CSV level must contain three metadata rows')
	}
	const first = (lines[0] ?? '').split(',')
	const camera = (lines[1] ?? '').split(',')
	const validation = (lines[2] ?? '').split(',')
	if (first.length !== 3 || camera.length !== 8 || validation.length !== 6) {
		throw new Error('CSV level metadata row has invalid column count')
	}

	const uid = first[2] ?? ''
	if (!uid) {
		throw new Error('CSV level UID is missing')
	}
	for (let index = 0; index < camera.length; index++) {
		parseFinite(camera[index] ?? '', `camera[${index}]`)
	}

	const validationTime = parseMedalTime(validation[0])
	const gold = parseMedalTime(validation[1])
	const silver = parseMedalTime(validation[2])
	const bronze = parseMedalTime(validation[3])
	const skybox = parseFinite(validation[4] ?? '', 'skybox')
	const ground = parseFinite(validation[5] ?? '', 'ground')

	const blocks: ParsedCsvBlock[] = []
	for (const line of lines.slice(3)) {
		if (!line.trim()) {
			continue
		}
		const values = normalizeBlockValues(line.split(','))
		const id = parseFinite(values[0] ?? '', 'block id')
		const rawPaints = values.slice(10, 27)
		const paints = rawPaints.map((value) => {
			const parsed = parseFinite(value, 'paint')
			return id === 2279 ? Math.trunc(Math.fround(parsed)) : parsed
		})
		const rawOptions = values.slice(27)
		const options = rawOptions.map((value) => Math.fround(parseFinite(value, 'option')))
		blocks.push({
			Id: id,
			Position: vector(values, 1, 'position'),
			Euler: vector(values, 4, 'euler'),
			Scale: vector(values, 7, 'scale'),
			Paints: paints,
			Options: options,
			rawPosition: values.slice(1, 4).map(formatDecimal) as [string, string, string],
			rawEuler: values.slice(4, 7).map(formatDecimal) as [string, string, string],
			rawScale: values.slice(7, 10).map(formatDecimal) as [string, string, string],
		})
	}

	const metadataBlocks = blocks.map((block) => ({
		id: block.Id,
		isCheckpoint: (block.Options[5] ?? 0) >= 0.5,
	}))
	return {
		format: levelFormat.csv,
		hash: adventure ? uid : calculateHash(skybox, ground, blocks),
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
