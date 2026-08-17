import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appRoot = resolve(import.meta.dirname, '../../app')
const repoRoot = resolve(import.meta.dirname, '../../../..')

async function appSource(path: string) {
	return readFile(resolve(appRoot, path), 'utf8')
}

describe('playlist integration contracts', () => {
	it('keeps LevelCard link and playlist control as sibling interactions', async () => {
		const source = await appSource('components/level/LevelCard.vue')
		const linkEnd = source.indexOf('</NuxtLink>')
		const lastLinkEnd = source.lastIndexOf('</NuxtLink>')
		const addButton = source.indexOf('<PlaylistAddButton')
		expect(source).toContain('<article')
		expect(linkEnd).toBeGreaterThan(0)
		expect(addButton).toBeGreaterThan(lastLinkEnd)
		expect(source.slice(source.indexOf('<NuxtLink'), linkEnd)).not.toContain(
			'<PlaylistAddButton',
		)
		expect(source).toContain('<PlaylistAddButton :level="level" block class="mt-4 w-full" />')
		expect(source).not.toContain('icon-only')
		expect(source).not.toContain('level-playlist-action')
		expect(source).not.toContain('<style scoped>')
	})

	it('exposes playlist action on detail hero and public playlist workspace', async () => {
		const [hero, page, workspace, toolbar] = await Promise.all([
			appSource('components/level/LevelDetailHero.vue'),
			appSource('pages/playlist.vue'),
			appSource('components/playlist/PlaylistWorkspace.vue'),
			appSource('components/playlist/PlaylistLibraryToolbar.vue'),
		])
		expect(hero).toContain('<PlaylistAddButton')
		expect(page).toContain('<PlaylistWorkspace')
		expect(page).not.toMatch(/useSession|requireAuth|middleware/)
		expect(workspace).toContain('<PlaylistLevelBrowser')
		expect(workspace).toContain('<PlaylistLevelList')
		expect(toolbar).toContain('@drop.prevent="dropFile"')
	})

	it('hydrates direct playlist visits before exposing library actions', async () => {
		const [plugin, workspace, toolbar] = await Promise.all([
			appSource('plugins/playlists.client.ts'),
			appSource('components/playlist/PlaylistWorkspace.vue'),
			appSource('components/playlist/PlaylistLibraryToolbar.vue'),
		])
		expect(plugin).toContain('onNuxtReady')
		expect(workspace).toContain('const { activePlaylist, hydrated } = storeToRefs(store)')
		expect(workspace).toContain('v-if="hydrated"')
		expect(toolbar).toContain('storeToRefs(store)')
	})

	it('uses full-width workspace, contextual import dropzone, and list count', async () => {
		const [page, workspace, toolbar, settings, levels] = await Promise.all([
			appSource('pages/playlist.vue'),
			appSource('components/playlist/PlaylistWorkspace.vue'),
			appSource('components/playlist/PlaylistLibraryToolbar.vue'),
			appSource('components/playlist/PlaylistSettingsForm.vue'),
			appSource('components/playlist/PlaylistLevelList.client.vue'),
		])
		expect(page).toContain('class="max-w-none')
		expect(toolbar).toContain('border-dashed border-border bg-muted/25')
		expect(toolbar).toContain("$t('playlist.import.drop')")
		expect(toolbar).toContain('sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2')
		expect(workspace.match(/<PlaylistLibraryToolbar/g)).toHaveLength(1)
		expect(workspace.indexOf('<PlaylistLibraryToolbar')).toBeLessThan(
			workspace.indexOf('<PlaylistSettingsForm'),
		)
		expect(settings).not.toContain('levelCount')
		expect(levels).toContain("$t('playlist.levels.count'")
	})

	it('toggles shared level actions between add and remove', async () => {
		const [action, translations] = await Promise.all([
			appSource('components/playlist/PlaylistAddButton.client.vue'),
			readFile(resolve(repoRoot, 'packages/web/i18n/locales/en.json'), 'utf8'),
		])
		expect(action).toContain('if (added.value)')
		expect(action).toContain('store.removeLevel')
		expect(action).toContain("t('playlist.actions.remove')")
		expect(action).toContain(':disabled="!added && !canAdd"')
		expect(action).toContain(":color=\"added ? 'error' : 'primary'\"")
		expect(action).toContain('variant="solid"')
		expect(action).toContain("'i-tabler-playlist-x'")
		expect(action).toContain("'i-tabler-playlist-add'")
		expect(action).not.toContain('iconOnly')
		expect(action).not.toContain('playlist.actions.added')
		expect(JSON.parse(translations).playlist.actions.added).toBeUndefined()
	})

	it('includes required metadata in every shared LevelCard query and mapping', async () => {
		const documents = [
			'adventure.graphql',
			'dashboard.graphql',
			'dashboardViewer.graphql',
			'userLevels.graphql',
			'levelDetail.graphql',
		]
		const documentSources = await Promise.all(
			documents.map((path) =>
				readFile(resolve(repoRoot, 'packages/graphql/documents/web/queries', path), 'utf8'),
			),
		)
		for (const source of documentSources) {
			expect(source).toContain('fileUid')
			expect(source).toContain('fileAuthor')
			expect(source).toContain('workshopId')
		}

		const mappings = ['useAdventure.ts', 'useDashboard.ts', 'useUserLevels.ts', 'useLevels.ts']
		for (const path of mappings) {
			const source = await appSource(`composables/${path}`)
			expect(source).toContain('fileUid:')
			expect(source).toContain('fileAuthor:')
			expect(source).toContain('workshopId:')
		}
	})

	it('batches legacy resolution by 100 and filters public non-deleted levels', async () => {
		const [resolver, query] = await Promise.all([
			appSource('composables/useLegacyPlaylistResolver.ts'),
			readFile(
				resolve(repoRoot, 'packages/graphql/documents/web/queries/playlist.graphql'),
				'utf8',
			),
		])
		expect(resolver).toContain('start += 100')
		expect(resolver).toContain('slice(start, start + 100)')
		expect(query).toContain('fileUid: { in: $uids }')
		expect(query).toContain('deleted: { equalTo: false }')
		expect(query).toContain('publiclyVisible: { equalTo: true }')
	})

	it('registers route navigation, footer link, translation, and playlist icon', async () => {
		const [navigation, footer, icons, translations] = await Promise.all([
			appSource('utils/navigation.ts'),
			appSource('components/layout/AppFooter.vue'),
			appSource('utils/icons.ts'),
			readFile(resolve(repoRoot, 'packages/web/i18n/locales/en.json'), 'utf8'),
		])
		expect(navigation).toContain("'/playlist': ['/playlist']")
		expect(navigation).toContain("to: '/playlist'")
		expect(footer).toContain("t('nav.playlist'), '/playlist', 'layout-list'")
		expect(icons).toContain('IconLayoutList')
		expect(JSON.parse(translations).pages.playlist).toBeDefined()
	})

	it('loads English messages through a TypeScript locale entrypoint', async () => {
		const [config, localeEntrypoint] = await Promise.all([
			readFile(resolve(repoRoot, 'packages/web/nuxt.config.ts'), 'utf8'),
			readFile(resolve(repoRoot, 'packages/web/i18n/locales/en.ts'), 'utf8'),
		])
		expect(config).toContain("files: ['en.ts']")
		expect(localeEntrypoint).toContain("import messages from './en.json'")
		expect(localeEntrypoint).toContain('export default messages')
	})
})
