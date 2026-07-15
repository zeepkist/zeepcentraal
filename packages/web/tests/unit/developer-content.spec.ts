import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSchema, Kind, parse, validate } from 'graphql'
import { describe, expect, test } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const contentRoot = join(webRoot, 'content')
const guidePath = join(contentRoot, 'developer/graphql.md')
const guide = readFileSync(guidePath, 'utf8')
const schema = buildSchema(
	readFileSync(join(repositoryRoot, 'packages/graphql/schema.graphql'), 'utf8'),
)

function filesUnder(path: string, extension: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(path, entry.name)
		if (entry.isDirectory()) return filesUnder(fullPath, extension)

		return extname(entry.name) === extension ? [fullPath] : []
	})
}

function graphqlExamples(source: string): string[] {
	return [...source.matchAll(/```graphql\s+([\s\S]*?)```/g)].map((match) => match[1] ?? '')
}

describe('Developer Portal content', () => {
	test('validates every GraphQL example against current schema', () => {
		const examples = graphqlExamples(guide)
		expect(examples.length).toBeGreaterThanOrEqual(4)

		for (const example of examples) {
			const document = parse(example)
			expect(validate(schema, document)).toEqual([])

			for (const definition of document.definitions) {
				if (definition.kind !== Kind.OPERATION_DEFINITION) continue
				expect(definition.operation).toBe('query')
				expect(definition.name?.value).toMatch(/^MyApplication_/)
			}
		}
	})

	test('documents required client, pagination, cost, caching, and attribution guidance', () => {
		for (const requiredText of [
			'operationName',
			'X-Client: my-application-name',
			'X-Client: my-application-name@1.0.0',
			'X-Query-Cost',
			'first: 0',
			'defaults to 100 rows',
			'maximum accepted value is 1,000',
			'query-cost ceiling is **5,000**',
			'60 requests per minute',
			'four concurrent requests',
			'15 seconds',
			'5 minutes',
			'1 hour',
			'24 hours',
			'Powered by ZeepCentraal',
		]) {
			expect(guide).toContain(requiredText)
		}
	})

	test('keeps Ruru exclusive to GraphQL guide content', () => {
		const filesContainingRuru = filesUnder(contentRoot, '.md').filter((file) =>
			readFileSync(file, 'utf8').includes('Ruru'),
		)

		expect(filesContainingRuru).toEqual([guidePath])
	})

	test('keeps Developer Portal query-only', () => {
		expect(guide).not.toMatch(/subscription/i)
		expect(guide).not.toMatch(/\bmutation\b/i)
	})

	test('uses request-free MDC presentation components', () => {
		const alert = readFileSync(join(webRoot, 'app/components/content/ContentAlert.vue'), 'utf8')
		const document = readFileSync(
			join(webRoot, 'app/components/content/ContentDocument.vue'),
			'utf8',
		)
		const resourceCard = readFileSync(
			join(webRoot, 'app/components/content/DeveloperResourceCard.vue'),
			'utf8',
		)

		expect(alert).toContain("type AlertType = 'notice' | 'important' | 'reminder'")
		expect(alert).toContain('<UAlert')
		expect(document).toContain('<UContentToc')
		expect(document).toContain('lg:sticky lg:top-24')
		expect(resourceCard).toContain("target: '_blank'")
		for (const source of [alert, document, resourceCard]) {
			expect(source).not.toMatch(/useFetch|\$fetch|useQuery/)
		}
	})
})
