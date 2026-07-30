import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Kind, parse, visit } from 'graphql'
import { describe, expect, test } from 'vitest'

const graphqlDir = fileURLToPath(new URL('../../app/graphql', import.meta.url))
const appDir = fileURLToPath(new URL('../../app', import.meta.url))
const composablesDir = fileURLToPath(new URL('../../app/composables', import.meta.url))
const urqlPlugin = fileURLToPath(new URL('../../app/plugins/urql.ts', import.meta.url))

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

	test('connections use bounded cursor pagination without offsets', () => {
		const connections = new Set([
			'levelItems',
			'levels',
			'personalBestGlobals',
			'recordHistoryEntries',
			'records',
			'recordStatistics',
			'users',
			'userPointContributions',
			'userPoints',
			'votes',
			'worldRecordGlobals',
			'zslLevelResults',
			'zslLevels',
			'zslRoundResults',
			'zslRounds',
			'zslSeasonResults',
			'zslSeasons',
		])

		for (const file of filesUnder(graphqlDir, '.graphql')) {
			const document = parse(readFileSync(file, 'utf8'))
			visit(document, {
				Field(node) {
					const argumentNames = new Set(
						node.arguments?.map((argument) => argument.name.value),
					)
					expect(argumentNames.has('offset')).toBe(false)
					if (
						connections.has(node.name.value) &&
						node.selectionSet?.selections.some(
							(selection) =>
								selection.kind === Kind.FIELD &&
								['edges', 'nodes', 'pageInfo', 'totalCount'].includes(
									selection.name.value,
								),
						)
					) {
						expect(argumentNames.has('first') || argumentNames.has('last')).toBe(true)
					}
					for (const argument of node.arguments ?? []) {
						if (
							(argument.name.value === 'first' || argument.name.value === 'last') &&
							argument.value.kind === Kind.INT
						) {
							expect(Number(argument.value.value)).toBeLessThanOrEqual(1000)
						}
					}
				},
			})
		}
	})

	test('composables import GraphQL documents instead of inline operations', () => {
		for (const file of filesUnder(composablesDir, '.ts')) {
			const source = readFileSync(file, 'utf8')
			if (source.includes('useQuery') || source.includes('useSubscription')) {
				expect(
					source.includes('.graphql') || source.includes('~/graphql/generated/graphql'),
				).toBe(true)
				expect(source).not.toContain('query ZC_')
				expect(source).not.toContain('subscription ZC_')
			}
		}
	})

	test('live subscriptions pause only while pages are hidden', () => {
		const visibilityComposable = readFileSync(
			join(composablesDir, 'usePageVisibility.ts'),
			'utf8',
		)
		expect(visibilityComposable).toContain('useDocumentVisibility()')
		expect(visibilityComposable).toContain("visibility.value === 'visible'")
		expect(visibilityComposable).not.toContain('useWindowFocus')
		expect(visibilityComposable).not.toContain('document.hasFocus')

		const subscriptionFiles = [
			...filesUnder(appDir, '.ts'),
			...filesUnder(appDir, '.vue'),
		].filter((file) => readFileSync(file, 'utf8').includes('useSubscription'))
		expect(subscriptionFiles.length).toBeGreaterThan(0)

		for (const file of subscriptionFiles) {
			const source = readFileSync(file, 'utf8')
			const subscriptionCount = source.match(/\buseSubscription\s*\(/g)?.length ?? 0
			const visibilityPauseCount = source.match(/!pageVisible\.value/g)?.length ?? 0
			expect(source).toContain('const pageVisible = usePageVisibility()')
			expect(visibilityPauseCount).toBe(subscriptionCount)
		}
	})

	test('literal filters contain at least one field', () => {
		for (const file of filesUnder(graphqlDir, '.graphql')) {
			const document = parse(readFileSync(file, 'utf8'))

			visit(document, {
				Argument(node) {
					if (node.name.value !== 'filter' || node.value.kind !== Kind.OBJECT) return
					expect(node.value.fields.length).toBeGreaterThan(0)
				},
			})
		}
	})

	test('urql sends GraphQL queries using POST', () => {
		const source = readFileSync(urqlPlugin, 'utf8')

		expect(source).toContain('preferGetMethod: false')
	})

	test('below-fold urql queries use viewport pause gates', () => {
		for (const file of [
			'useDashboard.ts',
			'useLevelDetail.ts',
			'useUserCareer.ts',
			'useUserLevels.ts',
			'useUserResults.ts',
		]) {
			const source = readFileSync(join(composablesDir, file), 'utf8')
			expect(source).toContain('useViewportPrefetch()')
			expect(source).toContain('pause: computed(')
			expect(source).toContain('Prefetch.active.value')
		}
	})
})
