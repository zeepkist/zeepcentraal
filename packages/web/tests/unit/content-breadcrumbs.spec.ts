import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
	buildAncestorBreadcrumbs,
	formatBreadcrumbSegment,
} from '../../app/utils/contentBreadcrumbs'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))

describe('Content breadcrumbs', () => {
	test('links the section root for direct child pages', () => {
		expect(buildAncestorBreadcrumbs('/developer', 'Developer Portal', ['graphql'])).toEqual([
			{ label: 'Developer Portal', to: '/developer' },
		])
		expect(buildAncestorBreadcrumbs('/wiki', 'Wiki', ['getting-started'])).toEqual([
			{ label: 'Wiki', to: '/wiki' },
		])
	})

	test('links every ancestor while excluding the current page', () => {
		expect(buildAncestorBreadcrumbs('/wiki/', 'Wiki', ['some', 'nested', 'path'])).toEqual([
			{ label: 'Wiki', to: '/wiki' },
			{ label: 'Some', to: '/wiki/some' },
			{ label: 'Nested', to: '/wiki/some/nested' },
		])
		expect(formatBreadcrumbSegment('setup-modkist')).toBe('Setup Modkist')
	})

	test('uses request-free eyebrow styling and native links', () => {
		const breadcrumbs = readFileSync(
			join(webRoot, 'app/components/common/PageBreadcrumbs.vue'),
			'utf8',
		)
		const header = readFileSync(join(webRoot, 'app/components/common/PageHeader.vue'), 'utf8')
		const developer = readFileSync(join(webRoot, 'app/pages/developer/graphql.vue'), 'utf8')
		const wiki = readFileSync(join(webRoot, 'app/pages/wiki/[...slug].vue'), 'utf8')

		expect(breadcrumbs).toContain('uppercase tracking-wide text-primary')
		expect(breadcrumbs).toContain('<NuxtLink')
		expect(breadcrumbs).not.toMatch(/useFetch|\$fetch|useQuery/)
		expect(header).toContain('v-if="breadcrumbs?.length && breadcrumbLabel"')
		expect(developer).toContain("buildAncestorBreadcrumbs('/developer'")
		expect(wiki).toContain("buildAncestorBreadcrumbs('/wiki'")
	})
})
