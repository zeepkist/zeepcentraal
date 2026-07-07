import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Kind, parse, visit } from 'graphql'
import { describe, expect, test } from 'vitest'

const graphqlDir = fileURLToPath(new URL('../../app/graphql', import.meta.url))
const composablesDir = fileURLToPath(new URL('../../app/composables', import.meta.url))

function filesUnder(path: string, extension: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(path, entry.name)
		if (entry.isDirectory()) {
			return filesUnder(fullPath, extension)
		}

		return extname(entry.name) === extension ? [fullPath] : []
	})
}

describe('GraphQL operation conventions', () => {
	test('all operations are named with ZC_ prefix', () => {
		for (const file of filesUnder(graphqlDir, '.graphql')) {
			const document = parse(readFileSync(file, 'utf8'))

			visit(document, {
				OperationDefinition(node) {
					expect(node.name?.kind).toBe(Kind.NAME)
					expect(node.name?.value.startsWith('ZC_')).toBe(true)
				},
			})
		}
	})

	test('composables import GraphQL documents instead of inline operations', () => {
		for (const file of filesUnder(composablesDir, '.ts')) {
			const source = readFileSync(file, 'utf8')
			if (source.includes('useQuery')) {
				expect(source).toContain('.graphql')
				expect(source).not.toContain('query ZC_')
			}
		}
	})
})
