import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const pagesDir = fileURLToPath(new URL('../../app/pages', import.meta.url))

function vueFilesUnder(path: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(path, entry.name)
		if (entry.isDirectory()) return vueFilesUnder(fullPath)
		return extname(entry.name) === '.vue' ? [fullPath] : []
	})
}

describe('chart conventions', () => {
	test('bar charts declare their required y-axis fields', () => {
		for (const file of vueFilesUnder(pagesDir)) {
			const tags = readFileSync(file, 'utf8').match(/<BarChart\b[\s\S]*?\/>/g) ?? []
			for (const tag of tags) expect(tag).toContain(':y-axis=')
		}
	})
})
