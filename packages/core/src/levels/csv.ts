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
	parseFinite,
	presentBlockId,
} from './utils'
import { xxHash128Hex } from './xxhash'

interface ParsedCsvBlock extends CsvBlock {
	rawPosition: [string, string, string]
	rawEuler: [string, string, string]
	rawScale: [string, string, string]
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

function blockText(block: ParsedCsvBlock): string {
	return `Id: ${block.Id}, Position: ${vectorText(block.rawPosition)}, Euler: ${vectorText(block.rawEuler)}, Scale: ${vectorText(block.rawScale)}, Paints: ${block.Paints.join(', ')}, Options: ${block.Options.map(formatSingle).join(', ')}`
}

function faultyNormalizedBlockText(block: ParsedCsvBlock): string {
	return `Id: ${block.Id}, Position: ${vectorText(block.rawPosition)}, Euler: ${vectorText(block.rawEuler)}, Scale: ${vectorText(block.rawScale)}, Paints: ${block.Paints.join(', ')}, Options: ${block.Options.join(', ')}`
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
		const values = line.split(',')
		if (values.length !== 38) {
			throw new Error(`CSV block row has invalid column count: ${values.length}`)
		}
		const id = parseFinite(values[0] ?? '', 'block id')
		const rawPaints = values.slice(10, 27)
		const paints = rawPaints.map((value) => {
			const parsed = parseFinite(value, 'paint')
			return id === 2279 ? Math.trunc(parsed) : Math.trunc(parsed)
		})
		const rawOptions = values.slice(27, 38)
		blocks.push({
			Id: id,
			Position: vector(values, 1, 'position'),
			Euler: vector(values, 4, 'euler'),
			Scale: vector(values, 7, 'scale'),
			Paints: paints,
			Options: rawOptions.map((value) => Math.fround(parseFinite(value, 'option'))),
			rawPosition: values.slice(1, 4).map(formatDecimal) as [string, string, string],
			rawEuler: values.slice(4, 7).map(formatDecimal) as [string, string, string],
			rawScale: values.slice(7, 10).map(formatDecimal) as [string, string, string],
		})
	}
	return blocks
}

export function calculateCsvLevelXxHash(content: string): string {
	const lines = content.split(/\r?\n/)
	if (lines.length < 3) {
		throw new Error('CSV level must contain three metadata rows')
	}
	const validation = (lines[2] ?? '').split(',')
	if (validation.length !== 6) {
		throw new Error('CSV level validation row has invalid column count')
	}
	const skybox = parseFinite(validation[4] ?? '', 'skybox')
	const ground = parseFinite(validation[5] ?? '', 'ground')
	return xxHash128Hex(canonicalCsvContent(skybox, ground, parseCsvBlocksForHash(lines.slice(3))))
}

function calculateCsvLegacyHash(content: string): string {
	const lines = content.split(/\r?\n/)
	if (lines.length < 3) {
		throw new Error('CSV level must contain three metadata rows')
	}
	const validation = (lines[2] ?? '').split(',')
	if (validation.length !== 6) {
		throw new Error('CSV level validation row has invalid column count')
	}
	const skybox = parseFinite(validation[4] ?? '', 'skybox')
	const ground = parseFinite(validation[5] ?? '', 'ground')
	return calculateHash(skybox, ground, parseCsvBlocksForHash(lines.slice(3)))
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

export function calculateFaultyNormalizedCsvLevelXxHash(
	content: string,
	adventure = false,
	authorId = 0n,
): string | undefined {
	try {
		const parsed = parseCsvLevel(content, adventure, authorId)
		const lines = content.split(/\r?\n/)
		const validation = (lines[2] ?? '').split(',')
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
				const valueParsed = parseFinite(value, 'paint')
				return id === 2279 ? Math.trunc(Math.fround(valueParsed)) : valueParsed
			})
			const rawOptions = values.slice(27)
			blocks.push({
				Id: id,
				Position: vector(values, 1, 'position'),
				Euler: vector(values, 4, 'euler'),
				Scale: vector(values, 7, 'scale'),
				Paints: paints,
				Options: rawOptions.map((value) => Math.fround(parseFinite(value, 'option'))),
				rawPosition: values.slice(1, 4).map(formatDecimal) as [string, string, string],
				rawEuler: values.slice(4, 7).map(formatDecimal) as [string, string, string],
				rawScale: values.slice(7, 10).map(formatDecimal) as [string, string, string],
			})
		}
		const hash = xxHash128Hex(
			canonicalCsvContent(skybox, ground, blocks, faultyNormalizedBlockText),
		)
		return hash === parsed.hash ? undefined : hash
	} catch {
		return undefined
	}
}

export function parseCsvLevel(content: string, adventure = false, authorId = 0n): ParsedLevel {
	const lines = content.split(/\r?\n/)
	const first = (lines[0] ?? '').split(',')
	const camera = (lines[1] ?? '').split(',')
	const validation = (lines[2] ?? '').split(',')

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

	const blocks = parseCsvBlocksForMetadata(lines.slice(3))

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
	const faultyServerHash = calculateFaultyNormalizedCsvLevelXxHash(content, adventure, authorId)

	return {
		...parsed,
		hash,
		zeepHash: parsed.hash,
		faultyServerHash: faultyServerHash === hash ? undefined : faultyServerHash,
	}
}
