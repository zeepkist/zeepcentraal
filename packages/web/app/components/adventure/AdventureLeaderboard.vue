<script setup lang="ts">
import { pinAdventureViewer } from '~/utils/adventureLeaderboard'

const props = defineProps<{ series?: string }>()
const { t } = useAppI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const { scope, entries, page, pagination, result, live, prefetch } = useAdventureLeaderboard(computed(() => props.series), viewerId)
const { supporters } = useSupporterBadges()
const standings = computed(() => pinAdventureViewer(entries.value, scope.value?.playerEntry))
const expandedUserId = shallowRef<number>()
watch([() => props.series, pagination.variables], () => { expandedUserId.value = undefined })
function toggle(userId: number) { expandedUserId.value = expandedUserId.value === userId ? undefined : userId }
async function viewYourLevels() {
	expandedUserId.value = viewerId.value
	await nextTick()
	document.getElementById(`adventure-player-${viewerId.value}-levels`)?.scrollIntoView({ block: 'nearest' })
}
const paginationLabels = computed(() => ({
	label: t('common.pagination'), loadingLabel: t('common.loading'),
	firstLabel: t('common.first'), previousLabel: t('common.previous'),
	nextLabel: t('common.next'), lastLabel: t('common.last'),
}))
useDiscordComponentEmbed(() => ({
	title: props.series ? `Adventure | ${props.series}` : 'Adventure leaderboard',
	description: scope.value ? `${scope.value.totalPlayers} players | ${scope.value.totalLevels} levels` : undefined,
	rows: result.error.value ? undefined : entries.value.slice(0, 3).map(discordStandingRow),
	links: [{ label: 'Global standings', url: '/adventure' }],
}))
await prefetch()
</script>

<template>
	<section class="space-y-5" :aria-label="t('adventure.leaderboard.title')">
		<SectionHeader :title="t('adventure.leaderboard.title')" :description="t('adventure.leaderboard.rules')" />
		<AdventurePlayerProgress v-if="viewerId && scope" :leaderboard="scope" :series="series" @view-levels="viewYourLevels" />
		<AdventurePlaylistActions v-else :series="series" />
		<p v-if="scope" class="text-sm text-muted">{{ t('adventure.leaderboard.participants', { count: scope.totalPlayers ?? 0 }) }}</p>
		<DataState :pending="pagination.isInitialPending(result.fetching.value, standings.length)" :error="result.error.value?.message" :empty="standings.length === 0" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('adventure.leaderboard.empty')">
			<AdventureLeaderboardTable :entries="standings" :viewer-id="viewerId" :supporters="supporters" :series="series" :expanded-user-id="expandedUserId" @toggle="toggle" />
		</DataState>
		<UAlert v-if="live.error.value" color="warning" variant="soft" :title="t('adventure.leaderboard.liveError')" />
		<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="result.fetching.value" v-bind="paginationLabels" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
	</section>
</template>
