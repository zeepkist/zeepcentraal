import { countCheckpoints, countFinishes } from './metadata'
import { levelFormat, type ParsedLevel } from './types'

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

function requiredNumber(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`JSON level ${label} is invalid`)
	}
	return value
}

export function parseJsonLevel(content: string, adventure = false): ParsedLevel {
	const parsed = JSON.parse(content) as JsonLevel
	const uid = parsed.level?.UID
	const zeepHash = parsed.level?.zeepHash
	const blocks = parsed.blox
	if (!uid || !zeepHash || !Array.isArray(blocks)) {
		throw new Error('JSON level is missing UID, zeepHash, or blox')
	}
	const metadataBlocks = blocks.map((block) => ({
		id: requiredNumber(block.i, 'block id'),
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
		validationTimeAuthor: requiredNumber(parsed.medals?.author, 'author medal'),
		validationTimeGold: requiredNumber(parsed.medals?.gold, 'gold medal'),
		validationTimeSilver: requiredNumber(parsed.medals?.silver, 'silver medal'),
		validationTimeBronze: requiredNumber(parsed.medals?.bronze, 'bronze medal'),
		amountCheckpoints: countCheckpoints(metadataBlocks),
		amountFinishes: countFinishes(metadataBlocks),
		amountBlocks: blocks.length,
		typeGround: requiredNumber(parsed.enviro?.groundMat, 'ground material'),
		typeSkybox: requiredNumber(parsed.enviro?.skybox, 'skybox'),
		blocks,
	}
}
