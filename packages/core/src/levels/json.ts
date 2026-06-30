import { countCheckpoints, countFinishes } from './metadata'
import { levelFormat, type ParsedLevel, type ParsedLevelV2 } from './types'
import { medalTime, numberOrDefault, presentBlockId } from './utils'
import { xxHash128Hex } from './xxhash'

interface JsonBlock {
	i: number
	[key: string]: unknown
}

interface JsonLevel {
	level?: { UID?: string; zeepHash?: string }
	author?: { name?: string; StmID?: number | string }
	medals?: { author?: number; gold?: number; silver?: number; bronze?: number }
	enviro?: { skybox?: number; groundMat?: number }
	blox?: JsonBlock[]
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value)
	}
	if (typeof value === 'string') {
		return JSON.stringify(value)
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`
	}
	if (typeof value === 'object' && value !== null) {
		return `{${Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
			)
			.join(',')}}`
	}
	throw new Error(`JSON level contains unsupported value: ${String(value)}`)
}

function canonicalJsonBlocks(blocks: JsonBlock[]): string {
	return `[${blocks
		.filter((block) => block.i !== presentBlockId)
		.map((block, index) => ({ block, index, canonical: canonicalJson(block) }))
		.sort(
			(left, right) =>
				(left.canonical < right.canonical
					? -1
					: left.canonical > right.canonical
						? 1
						: 0) || left.index - right.index,
		)
		.map((entry) => entry.canonical)
		.join(',')}]`
}

export function calculateJsonLevelXxHash(content: string): string {
	const json = JSON.parse(content) as JsonLevel
	const blocks = json.blox
	if (!Array.isArray(blocks)) {
		throw new Error('JSON level is missing blox')
	}
	return xxHash128Hex(canonicalJsonBlocks(blocks))
}

export function parseJsonLevel(content: string, adventure = false): ParsedLevel {
	const parsed = JSON.parse(content) as JsonLevel
	const uid = parsed.level?.UID ?? ''
	const zeepHash = parsed.level?.zeepHash ?? uid
	const blocks = Array.isArray(parsed.blox) ? parsed.blox : []
	const metadataBlocks = blocks.map((block) => ({
		id: numberOrDefault(block.i),
		isCheckpoint: (block.d as { n?: { ch5?: unknown } } | null | undefined)?.n?.ch5 === 1,
	}))
	const rawSteamId = content.match(/"StmID"\s*:\s*"?(\d+)"?/)?.[1]
	const authorId = rawSteamId ? BigInt(rawSteamId) : 0n
	return {
		format: levelFormat.json,
		hash: adventure ? uid : zeepHash,
		uid,
		authorId,
		fileAuthor: parsed.author?.name ?? '',
		validationTimeAuthor: medalTime(parsed.medals?.author),
		validationTimeGold: medalTime(parsed.medals?.gold),
		validationTimeSilver: medalTime(parsed.medals?.silver),
		validationTimeBronze: medalTime(parsed.medals?.bronze),
		amountCheckpoints: countCheckpoints(metadataBlocks),
		amountFinishes: countFinishes(metadataBlocks),
		amountBlocks: blocks.length,
		typeGround: numberOrDefault(parsed.enviro?.groundMat),
		typeSkybox: numberOrDefault(parsed.enviro?.skybox),
		blocks,
	}
}

export function parseJsonLevelV2(content: string, adventure = false): ParsedLevelV2 {
	const parsed = parseJsonLevel(content, adventure)
	const hash = calculateJsonLevelXxHash(content)
	return {
		...parsed,
		hash,
		zeepHash: parsed.hash,
	}
}
