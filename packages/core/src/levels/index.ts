export * from './csv'
export * from './json'
export * from './types'
export * from './utils'

import { parseCsvLevel, parseCsvLevelV2 } from './csv'
import { parseJsonLevel, parseJsonLevelV2 } from './json'
import type { ParsedLevel, ParsedLevelV2 } from './types'

export function parseLevel(content: string, adventure = false, workshopAuthorId = 0n): ParsedLevel {
	const normalized = content.replace(/^\uFEFF/, '')
	return normalized.trimStart().startsWith('{')
		? parseJsonLevel(normalized, adventure)
		: parseCsvLevel(normalized, adventure, workshopAuthorId)
}

export function parseLevelV2(
	content: string,
	adventure = false,
	workshopAuthorId = 0n,
): ParsedLevelV2 {
	const normalized = content.replace(/^\uFEFF/, '')
	return normalized.trimStart().startsWith('{')
		? parseJsonLevelV2(normalized, adventure)
		: parseCsvLevelV2(normalized, adventure, workshopAuthorId)
}
