import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImage } from '@nuxt/image/runtime'
import createNoneProvider from '@nuxt/image/runtime/providers/none'
import { describe, expect, it } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const appRoot = fileURLToPath(new URL('../../app', import.meta.url))
const appFiles = collectFiles(appRoot)
const vueSources = appFiles
	.filter((file) => file.endsWith('.vue'))
	.map((file) => ({ file, source: readFileSync(file, 'utf8') }))
const nuxtConfigSource = readFileSync(join(webRoot, 'nuxt.config.ts'), 'utf8')
const webPackage = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8'))

describe('web performance contracts', () => {
	it('passes Nuxt image URLs through without server processing', () => {
		const images = vueSources.flatMap(({ file, source }) =>
			[...source.matchAll(/<NuxtImg\b[\s\S]*?\/>/g)].map((match) => ({
				file,
				tag: match[0],
			})),
		)
		const image = createImage({
			providers: { none: { defaults: {}, setup: createNoneProvider } },
			nuxt: { baseURL: '/' },
			presets: {},
			provider: 'none',
			screens: {},
			alias: {},
			domains: [],
			densities: [1, 2],
			format: ['avif'],
			runtimeConfig: {} as never,
		})

		expect(image('/android-chrome-192x192.png', { width: 64 })).toBe(
			'/android-chrome-192x192.png',
		)
		expect(image('https://cdn.zeepki.st/thumbnails/example.jpg', { width: 640 })).toBe(
			'https://cdn.zeepki.st/thumbnails/example.jpg',
		)
		expect(nuxtConfigSource).toMatch(/image:\s*{\s*provider: 'none',?\s*}/)
		expect(nuxtConfigSource).not.toMatch(/\bipx\b/i)
		expect(webPackage.dependencies).not.toHaveProperty('ipx')
		expect(images.length).toBeGreaterThan(0)
		for (const image of images) {
			expect(image.tag, image.file).not.toMatch(/\bprovider=/)
		}
		expect(vueSources.map(({ source }) => source).join('\n')).not.toContain('<NuxtPicture')
	})

	it('keeps replay, comparison, and WebSocket work behind activation', () => {
		const recordRoute = source('pages/record/[recordId].vue')
		const recordExperience = source('components/record/RecordGhostExperience.client.vue')
		const levelRoute = source('pages/level/[xxh128].vue')
		const levelGhosts = source('components/level/LevelGhostExplorerTab.client.vue')
		const playback = source('composables/useGhostPlaybackSources.ts')
		const comparisons = source('composables/useRecordComparisons.ts')
		const urql = source('plugins/urql.ts')

		expect(recordRoute).toContain('<LazyRecordGhostExperience')
		expect(recordRoute).toContain("rootMargin: '25% 0px'")
		expect(recordExperience).toContain('<LazyRecordReplayWorkspace')
		expect(levelRoute).toContain('<LazyLevelGhostExplorerTab')
		expect(levelGhosts).toContain('<LazyRecordReplayWorkspace')
		expect(playback).toContain('active?: MaybeRefOrGetter<boolean>')
		expect(playback).toContain("await import(\n\t\t\t\t'~/utils/ghostDownload.client'")
		expect(comparisons).toContain('!active.value ||')
		expect(urql).toContain('import type { Client as GraphqlWsClient')
		expect(urql).toContain("import('graphql-ws')")
		expect(urql).not.toContain("import { createClient as createWsClient } from 'graphql-ws'")
	})

	it('provides content-shaped pending slots and visited tab retention', () => {
		expect(source('components/common/DataState.vue')).toContain('<slot name="pending">')
		expect(source('pages/index.vue')).toContain('<DashboardStatisticsSkeleton')
		expect(source('components/user/UserLevelCollection.vue')).toContain('<LevelGridSkeleton')
		const tabs = source('components/common/DetailSectionTabs.vue')
		expect(tabs).toContain('visitedTabs.has(item.value)')
		expect(tabs).toContain(':unmount-on-hide="false"')
	})

	it('keeps user secondary data in focused, inactive-by-default query owners', () => {
		const profile = source('composables/useUserProfile.ts')
		const career = source('composables/useUserCareer.ts')
		const results = source('composables/useUserResults.ts')
		const levels = source('composables/useUserLevels.ts')

		for (const composable of [
			'useUserCareer',
			'useUserSuperLeague',
			'useUserResults',
			'useUserLevels',
		]) {
			expect(profile).toContain(`${composable}(`)
		}
		expect(career).toContain('!careerSecondaryActive.value')
		expect(results).toContain('!toValue(active)')
		expect(levels).toContain('!toValue(active)')
	})
})

function source(relativePath: string) {
	return readFileSync(join(appRoot, relativePath), 'utf8')
}

function collectFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name)
		return statSync(path).isDirectory() ? collectFiles(path) : [path]
	})
}
