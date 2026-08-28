import { readdir } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import { parseLevelV2 } from '@zeepkist/core/levels'

const MAX_LEVEL_FILE_BYTES = 64 * 1024 * 1024
const MAX_WORKSHOP_ENTRIES = 4_096
const MAX_WORKSHOP_DEPTH = 16

export interface WorkshopLevelFile {
	content: string
	fileUid: string
	name: string
	path: string
}

export async function findWorkshopLevelFile(directory: string, fileUid: string) {
	for (const path of await findLevelPaths(directory)) {
		const file = Bun.file(path)
		if (file.size > MAX_LEVEL_FILE_BYTES) continue
		const content = await file.text()
		try {
			const parsed = parseLevelV2(content)
			if (parsed.uid === fileUid) {
				return {
					content,
					fileUid,
					name: parse(path).name,
					path,
				} satisfies WorkshopLevelFile
			}
		} catch {}
	}
	return undefined
}

async function findLevelPaths(directory: string) {
	const paths: string[] = []
	let visitedEntries = 0
	async function visit(current: string, depth: number): Promise<void> {
		if (depth > MAX_WORKSHOP_DEPTH)
			throw new Error('Workshop item directory nesting is too deep')
		const entries = await readdir(current, { withFileTypes: true })
		for (const entry of entries) {
			visitedEntries++
			if (visitedEntries > MAX_WORKSHOP_ENTRIES) {
				throw new Error('Workshop item contains too many files')
			}
			const path = join(current, entry.name)
			if (entry.isDirectory()) await visit(path, depth + 1)
			else if (entry.isFile() && extname(entry.name).toLowerCase() === '.zeeplevel')
				paths.push(path)
		}
	}
	await visit(directory, 0)
	return paths.sort()
}
