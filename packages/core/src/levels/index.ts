export * from './csv'
export * from './json'
export * from './types'

import { parseCsvLevel } from './csv'
import { parseJsonLevel } from './json'
import type { ParsedLevel } from './types'

export function parseLevel(content: string, adventure = false, workshopAuthorId = 0n): ParsedLevel {
	return content.trimStart().startsWith('{')
		? parseJsonLevel(content, adventure)
		: parseCsvLevel(content, adventure, workshopAuthorId)
}
