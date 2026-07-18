import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appRoot = new URL('../../app/', import.meta.url)
const serverRoot = new URL('../../server/', import.meta.url)
const localePath = new URL('../../i18n/locales/en.json', import.meta.url)
const locale = JSON.parse(readFileSync(localePath, 'utf8')) as Record<string, unknown>

const TRANSLATION_KEY = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/
const QUOTED_KEY = /(['"])([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+)\1/g
const STATIC_TEMPLATE_KEY = /`([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+)`/g

type SourceFile = {
	path: string
	source: string
}

function productionSources(): SourceFile[] {
	const files: SourceFile[] = []
	for (const root of [appRoot, serverRoot]) {
		const rootPath = fileURLToPath(root)
		const visit = (directory: string) => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name)
				if (entry.isDirectory()) {
					if (entry.name !== 'generated') visit(path)
					continue
				}
				if (!['.ts', '.vue'].includes(extname(entry.name))) continue
				files.push({
					path: relative(rootPath, path).replaceAll('\\', '/'),
					source: readFileSync(path, 'utf8'),
				})
			}
		}
		visit(rootPath)
	}
	return files
}

function flattenLocale(value: unknown, prefix = ''): string[] {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : []
	return Object.entries(value).flatMap(([key, child]) =>
		flattenLocale(child, prefix ? `${prefix}.${key}` : key),
	)
}

function closingParenthesis(source: string, openingIndex: number): number {
	let depth = 1
	let quote: "'" | '"' | '`' | null = null
	let escaped = false
	for (let index = openingIndex + 1; index < source.length; index += 1) {
		const character = source[index]
		if (quote) {
			if (escaped) {
				escaped = false
				continue
			}
			if (character === '\\') {
				escaped = true
				continue
			}
			if (character === quote) quote = null
			continue
		}
		if (character === "'" || character === '"' || character === '`') {
			quote = character
			continue
		}
		if (character === '(') depth += 1
		if (character === ')') depth -= 1
		if (depth === 0) return index
	}
	return -1
}

function exactTranslationCalls(source: string): string[] {
	const keys = new Set<string>()
	const call = /(?:^|[^A-Za-z0-9_$])(\$t|t)\s*\(/gm
	for (const match of source.matchAll(call)) {
		const openingIndex = (match.index ?? 0) + match[0].lastIndexOf('(')
		const closingIndex = closingParenthesis(source, openingIndex)
		if (closingIndex < 0) continue
		const body = source.slice(openingIndex + 1, closingIndex)
		for (const keyMatch of body.matchAll(QUOTED_KEY)) keys.add(keyMatch[2] ?? '')
		for (const keyMatch of body.matchAll(STATIC_TEMPLATE_KEY)) keys.add(keyMatch[1] ?? '')
	}
	return [...keys].filter((key) => TRANSLATION_KEY.test(key))
}

function pageSeoKeys(sources: SourceFile[]): string[] {
	const keys: string[] = []
	for (const { source } of sources) {
		for (const match of source.matchAll(/\busePageSeo\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)) {
			const page = match[1]
			keys.push(`pages.${page}.seo.title`, `pages.${page}.seo.description`)
		}
	}
	return keys
}

function scopedTelemetryKeys(sources: SourceFile[]): string[] {
	const source =
		sources.find(({ path }) => path === 'composables/useLevelTelemetryModel.ts')?.source ?? ''
	const prefixes = [
		'levels.detail.stats',
		'users.profile.telemetry',
		'pages.recordDetail.telemetry',
	]
	const suffixes = [...source.matchAll(/\bscopeT\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)].flatMap(
		(match) => (match[1] === 'notAvailable' ? [] : [match[1]]),
	)
	return [
		...prefixes.flatMap((prefix) => suffixes.map((suffix) => `${prefix}.${suffix}`)),
		...(source.includes("scopeT('notAvailable')")
			? ['pages.recordDetail.telemetry.notAvailable']
			: []),
	]
}

function recordAnalysisKeys(sources: SourceFile[]): string[] {
	const source =
		sources.find(({ path }) => path === 'utils/recordAnalysisLabels.ts')?.source ?? ''
	const aliases = {
		telemetry: 'pages.recordDetail.analysis.telemetry',
		events: 'pages.recordDetail.analysis.events',
		drift: 'pages.recordDetail.analysis.drift',
		coaching: 'pages.recordDetail.analysis.coaching',
		airControl: 'pages.recordDetail.analysis.airControl',
	} as const
	const keys = new Set<string>()
	for (const [alias, prefix] of Object.entries(aliases)) {
		const call = new RegExp(`\\b${alias}\\(\\s*(['"])([^'"]+)\\1`, 'g')
		for (const match of source.matchAll(call)) {
			const suffix = match[2]
			if (suffix && !suffix.includes('${')) keys.add(`${prefix}.${suffix}`)
		}
	}
	for (const match of source.matchAll(/\binsight\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g)) {
		const insight = match[1]
		keys.add(`pages.recordDetail.analysis.coaching.insights.${insight}.title`)
		keys.add(`pages.recordDetail.analysis.coaching.insights.${insight}.description`)
	}
	return [...keys]
}

function modkistFormatKeys(sources: SourceFile[]): string[] {
	const source =
		sources.find(({ path }) => path === 'components/content/ContentModkistReleasePanel.vue')
			?.source ?? ''
	const block = source.match(/\bconst formats = \[([^\]]+)] as const/)?.[1] ?? ''
	return [...block.matchAll(/['"]([A-Za-z0-9_-]+)['"]/g)].map(
		(match) => `wikiContent.modkist.formats.${match[1]}`,
	)
}

function externalPromoKeys(sources: SourceFile[]): string[] {
	const source = sources.find(({ path }) => path === 'utils/navigation.ts')?.source ?? ''
	const block = source.match(/export const externalLinks = \[([\s\S]*?)]/)?.[1] ?? ''
	return [...block.matchAll(/\bkey:\s*['"]([A-Za-z0-9_-]+)['"]/g)].map(
		(match) => `external.${match[1]}.label`,
	)
}

function modelTranslationKeys(sources: SourceFile[]): string[] {
	const keys: string[] = []
	for (const { source } of sources) {
		for (const match of source.matchAll(/\blabelKey:\s*['"]([^'"]+)['"]/g)) {
			if (match[1] && TRANSLATION_KEY.test(match[1])) keys.push(match[1])
		}
	}
	return keys
}

function runtimeTranslationKeys(sources: SourceFile[]): string[] {
	return [
		...sources.flatMap(({ source }) => exactTranslationCalls(source)),
		...modelTranslationKeys(sources),
		...pageSeoKeys(sources),
		...scopedTelemetryKeys(sources),
		...recordAnalysisKeys(sources),
		...modkistFormatKeys(sources),
		...externalPromoKeys(sources),
	].toSorted()
}

describe('English i18n usage', () => {
	const sourceKeys = new Set(runtimeTranslationKeys(productionSources()))
	const localeKeys = new Set(flattenLocale(locale))

	it('defines every runtime translation key', () => {
		const missing = [...sourceKeys].filter((key) => !localeKeys.has(key)).toSorted()
		expect(missing, `Missing English i18n keys:\n${missing.join('\n')}`).toEqual([])
	})

	it('contains no unused translation leaves', () => {
		const unused = [...localeKeys].filter((key) => !sourceKeys.has(key)).toSorted()
		expect(unused, `Unused English i18n keys:\n${unused.join('\n')}`).toEqual([])
	})
})
