<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.records.eyebrow')"
			:title="$t('pages.records.title')"
			:description="$t('pages.records.description')"
		>
			<template #actions>
				<div class="flex flex-wrap items-center justify-end gap-2">
					<RecordLiveControls
						:status="data.liveStatus.value"
						:labels="liveStatusLabels"
						:sound-enabled="sounds.enabled.value"
						:show-only-mine="Boolean(session.user)"
						:only-mine="sounds.onlyMine.value"
						@update:sound-enabled="sounds.setEnabled"
						@update:only-mine="sounds.setOnlyMine"
					/>
					<UButton v-if="session.user" to="/records/me" color="primary" variant="soft">
						<TablerIcon name="user-circle" class="size-4" />
						{{ $t('pages.records.myRecordsAction') }}
					</UButton>
				</div>
			</template>
		</PageHeader>

		<RecordHistoryToolbar
			:view="view"
			:view-label="$t('pages.records.tabs.label')"
			:view-options="tabOptions"
			:sort="sort"
			:sort-label="$t('pages.records.sort.label')"
			:sort-options="sortOptions"
			sort-id="records-sort"
			@update:view="data.setView"
			@update:sort="data.setSort"
		/>

		<DataState
			:pending="data.pagination.isInitialPending(data.result.fetching.value, data.rows.value.length)"
			:error="data.result.error.value?.message"
			:empty="data.rows.value.length === 0"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('pages.records.empty')"
			:skeletons="6"
		>
			<RecordHistoryTable
				:records="data.rows.value"
				:labels="tableLabels"
				:highlighted-record-ids="data.highlightedRecordIds.value"
				:live-update-label="$t('pages.records.liveUpdate')"
				:viewer-user-id="session.user?.id"
				status-mode="all"
				show-player
			/>
		</DataState>
		<CursorPagination
			class="mt-4"
			:page="data.page.value"
			:can-go-previous="data.pagination.canGoPrevious(data.page.value)"
			:can-go-next="data.pagination.canGoNext(data.page.value)"
			:pending="data.result.fetching.value"
			v-bind="paginationLabels"
			@first="data.pagination.first()"
			@previous="data.pagination.previous(data.page.value)"
			@next="data.pagination.next(data.page.value)"
			@last="data.pagination.last()"
		/>
	</UContainer>
</template>

<script setup lang="ts">
const session = useSessionStore()
const route = useRoute()
const { t } = useI18n()
const view = computed(() => normalizeRecordHistoryView(route.query.view))
const sort = computed(() => normalizeRecordHistorySort(route.query.sort))
const data = useRecordHistory({ view, sort, namespace: 'records' })
const viewerUserId = computed(() => session.user?.id)
const sounds = useRecordNotificationSounds({
	batch: data.newRecordBatch,
	viewerUserId,
	allowOnlyMine: true,
})

usePageSeo('records')

const tabOptions = computed(() => [
	{ value: 'recent' as const, label: t('pages.records.tabs.recent'), icon: 'clock-bolt' },
	{
		value: 'personal-bests' as const,
		label: t('pages.records.tabs.personalBests'),
		icon: 'star',
	},
	{
		value: 'world-records' as const,
		label: t('pages.records.tabs.worldRecords'),
		icon: 'trophy',
	},
])
const sortOptions = computed(() => [
	{ value: 'latest' as const, label: t('pages.records.sort.latest') },
	{ value: 'valuable-levels' as const, label: t('pages.records.sort.valuableLevels') },
	{ value: 'valuable-pbs' as const, label: t('pages.records.sort.valuablePbs') },
])
const tableLabels = computed(() => ({
	level: t('common.level'),
	player: t('common.user'),
	unknownPlayer: t('pages.records.table.unknownPlayer'),
	rank: t('common.rank'),
	time: t('common.time'),
	status: t('pages.records.table.status'),
	personalBest: t('pages.records.table.personalBest'),
	worldRecord: t('pages.records.table.worldRecord'),
	levelPoints: t('pages.records.table.levelPoints'),
	points: t('common.points'),
	rankedPoints: t('pages.records.table.rankedPoints'),
	date: t('pages.records.table.set'),
	notRanked: t('pages.records.table.notRanked'),
	decayPercentage: t('pages.records.table.decayPercentage'),
	openRecord: t('pages.records.table.openRecord'),
}))
const liveStatusLabels = computed(() => ({
	connecting: t('pages.records.live.connecting'),
	live: t('pages.records.live.active'),
	paused: t('pages.records.live.paused'),
	error: t('pages.records.live.error'),
	enableSound: t('pages.records.live.enableSound'),
	disableSound: t('pages.records.live.disableSound'),
	soundOn: t('pages.records.live.soundOn'),
	soundOff: t('pages.records.live.soundOff'),
	onlyMine: t('pages.records.live.onlyMine'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
</script>
