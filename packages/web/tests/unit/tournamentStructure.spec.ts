import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

function source(path: string) {
	return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('shared tournament web implementation', () => {
	test('keeps weekly and monthly routes as parameter-only wrappers', () => {
		for (const [root, type] of [
			['totw', 0],
			['totm', 1],
		] as const) {
			expect(source(`app/pages/${root}/index.vue`)).toContain(
				`<TournamentIndexPage :type="${type}"`,
			)
			expect(source(`app/pages/${root}/[slug].vue`)).toContain(
				`<TournamentDetailPage :type="${type}"`,
			)
		}
	})

	test('uses 12-card history, 50-row leaderboards, viewer pinning, and page-one live data', () => {
		const composable = source('app/composables/useTrackTournaments.ts')
		expect(composable).toContain("useCursorPagination(12, 'history')")
		expect(composable).toContain("useCursorPagination(50, 'standings')")
		expect(composable).toContain('pagination.isFirstPage.value')
		expect(composable).toContain('pinned: true')
		expect(composable).toContain('liveEnabled.value ? live.data.value')
		expect(composable).toContain('standings.value.filter((row) => !row.pinned).slice(0, 3)')
		expect(composable).toContain('setAt: node.record?.dateCreated')
	})

	test('hides future competition UI, links root, and marks it noindex', () => {
		const event = source('app/components/tournament/TournamentEvent.vue')
		expect(event).toContain('v-if="future"')
		expect(event).toContain(':back-to="tournamentPath(type)"')
		expect(event).toContain("future.value ? 'noindex, nofollow' : 'index, follow'")
	})

	test('presents tournament dates, live remaining time, competitors, and friendly periods', () => {
		const event = source('app/components/tournament/TournamentEvent.vue')
		const composable = source('app/composables/useTrackTournaments.ts')
		const card = source('app/components/tournament/TournamentCard.vue')
		const query = source('app/graphql/queries/trackTournaments.graphql')
		const liveOperation = query.slice(query.indexOf('subscription ZC_TrackTournamentLive'))
		expect(event).toContain("$t('tournaments.competitors')")
		expect(event).toContain(':value="numberFormat.format(totalCount)"')
		expect(event).not.toContain('numberFormat.format(tournament.participantCount)')
		expect(composable).toContain(
			'const totalCount = computed(() => connection.value?.totalCount ?? 0)',
		)
		expect(composable).toContain('pagination.isFirstPage.value')
		expect(liveOperation).toMatch(/leaderboard: trackTournamentResults[\s\S]*?totalCount/)
		expect(event).toContain(':datetime="tournament.startAt"')
		expect(event).toContain('<NuxtTime :datetime="tournament.endAt" relative />')
		expect(event).not.toContain('time-zone="UTC"')
		expect(event).not.toContain('/> UTC')
		expect(event).toContain('date-style="short"')
		expect(event).toContain('whitespace-nowrap text-lg')
		expect(event).toContain('class="aspect-video w-full object-cover"')
		expect(event).not.toContain('{{ tournament.slug }}')
		expect(card).not.toContain('{{ tournament.slug }}')
		expect(query).toContain('filter: { deleted: { equalTo: false } }')
		expect(query).toContain('orderBy: [UPDATED_AT_DESC, ID_DESC]')
	})

	test('preserves leaderboard click targets and tournament ghost cap', () => {
		const table = source('app/components/tournament/TournamentLeaderboardTable.vue')
		const event = source('app/components/tournament/TournamentEvent.vue')
		expect(table).toContain('const playerPath')
		expect(table).toContain('`/user/$' + '{row.steamId}`')
		expect(table).toContain('const recordPath')
		expect(table).toContain(':datetime="row.setAt"')
		expect(table).toContain("$t('tournaments.delta')")
		expect(table).toContain('formatTournamentDelta(row.time, fastestTime)')
		expect(table).toContain('v-if="active" :datetime="row.setAt" relative')
		expect(table).toContain("$t('common.set')")
		expect(event).toContain(':datetime="entry.setAt"')
		expect(event).toContain('v-if="active" :datetime="entry.setAt" relative')
		expect(event).toContain(':fastest-time="podium[0]?.time"')
		expect(source('app/components/tournament/TournamentGhostExplorer.vue')).toContain(
			'.slice(0, 200)',
		)
	})

	test('keeps loaded tournament ghosts mounted and pauses them while collapsed', () => {
		const ghost = source('app/components/tournament/TournamentGhostExplorer.vue')
		expect(ghost).toContain('v-show="workspaceOpen"')
		expect(ghost).toContain(':active="workspaceActive"')
		expect(ghost).toContain('workspaceOpen.value = true')
		expect(ghost).toContain('workspaceOpen.value = !workspaceOpen.value')
		expect(ghost).toContain("$t('tournaments.ghosts.hide')")
		expect(ghost).toContain("$t('tournaments.ghosts.show')")
	})

	test('queries and renders rich same-format tournament navigation on detail pages', () => {
		const query = source('app/graphql/queries/trackTournaments.graphql')
		const composable = source('app/composables/useTrackTournaments.ts')
		const event = source('app/components/tournament/TournamentEvent.vue')
		const navigation = source('app/components/tournament/TournamentNavigation.vue')
		expect(query).toContain('query ZC_TrackTournamentNavigation')
		expect(query).toContain('startAt: { lessThan: $startAt }')
		expect(query).toContain('orderBy: [START_AT_DESC, ID_DESC]')
		expect(query).toContain('startAt: { greaterThan: $startAt }')
		expect(query).toContain('orderBy: [START_AT_ASC, ID_ASC]')
		expect(query).toContain('endAt: { greaterThan: $now }')
		expect(composable).toContain('!includeNavigation || !tournament.value')
		expect(event).toContain('v-if="detailPage && !navigationResult.fetching.value"')
		expect(navigation).toContain('<TournamentCard')
		expect(navigation).toContain(':to="tournamentPath(type)"')
		expect(navigation).toContain('tournamentPath(props.type, props.navigation.next.slug)')
	})

	test('subscribes to top 50 and latest 200 while sitemap excludes unstarted events', () => {
		const query = source('app/graphql/queries/trackTournaments.graphql')
		expect(query).toContain('leaderboard: trackTournamentResults(\n\t\t\tfirst: 50')
		expect(query).toContain('updateFeed: trackTournamentResults(\n\t\t\tfirst: 200')
		expect(source('app/graphql/queries/sitemapTournaments.graphql')).toContain(
			'startAt: { lessThanOrEqualTo: $now }',
		)
	})

	test('downloads started tournament playlists with attachment headers', () => {
		const query = source('app/graphql/queries/tournamentPlaylist.graphql')
		const endpoint = source('server/api/tournaments/playlist.get.ts')
		const actions = source('app/components/tournament/TournamentPlaylistActions.vue')
		const event = source('app/components/tournament/TournamentEvent.vue')
		const index = source('app/components/tournament/TournamentIndexPage.vue')
		expect(query).toContain('filter: { deleted: { equalTo: false } }')
		expect(query).toContain('worldRecordGlobal')
		expect(query).toContain('orderBy: [START_AT_DESC, ID_DESC]')
		expect(endpoint).toContain('startAt: { lessThanOrEqualTo: new Date().toISOString() }')
		expect(endpoint).toContain("'content-disposition'")
		expect(endpoint).toContain("'content-type': 'application/json; charset=utf-8'")
		expect(endpoint).toContain('first: 1000')
		expect(actions).toContain('<UFieldGroup')
		expect(actions).toContain('<UDropdownMenu')
		expect(actions).toContain('color="primary"')
		expect(actions).toContain('tournamentPlaylistPath(props.type, props.slug)')
		expect(actions).toContain('tournamentPlaylistPath(props.type)')
		expect(actions).toContain('tournamentPlaylistPath()')
		expect(event).toContain('<TournamentPlaylistActions')
		expect(index).toContain('v-if="!active && history.length > 0"')
	})
})
