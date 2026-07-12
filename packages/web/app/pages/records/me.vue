<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.myRecords.eyebrow')"
			:title="$t('pages.myRecords.title')"
			:description="$t('pages.myRecords.description')"
		/>

		<RecordHistoryToolbar
			:view="view"
			:view-label="$t('pages.myRecords.tabs.label')"
			:view-options="tabOptions"
			:sort="sort"
			:sort-label="$t('pages.myRecords.sort.label')"
			:sort-options="sortOptions"
			sort-id="my-records-sort"
			@update:view="data.setView"
			@update:sort="data.setSort"
		/>

		<RecordSetupPrompt
			v-if="!data.countResult.fetching.value && data.totalRecords.value === 0"
			:title="$t('pages.myRecords.setup.title')"
			:description="$t('pages.myRecords.setup.description')"
			:action-label="$t('pages.myRecords.setup.action')"
			href="/wiki/setup-modkist"
		/>

		<template v-else>
			<DataState
				:pending="
					data.countResult.fetching.value ||
					data.pagination.isInitialPending(data.result.fetching.value, data.rows.value.length)
				"
				:error="data.countResult.error.value?.message || data.result.error.value?.message"
				:empty="data.rows.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('pages.myRecords.empty')"
				:skeletons="6"
			>
				<RecordHistoryTable
					:records="data.rows.value"
					:labels="tableLabels"
					@select="openRecord"
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
		</template>
	</UContainer>
</template>

<script setup lang="ts">
const session = useSessionStore()
if (!session.user) {
	await navigateTo('/records', { replace: true })
}

const route = useRoute()
const { t } = useI18n()
const userId = computed(() => session.user?.id)
const view = computed(() => normalizeRecordHistoryView(route.query.view))
const sort = computed(() => normalizeRecordHistorySort(route.query.sort))
const data = useMyRecords(userId, view, sort)

useSeoMeta({
	title: () => t('pages.myRecords.seo.title'),
	description: () => t('pages.myRecords.seo.description'),
})

const tabOptions = computed(() => [
	{ value: 'recent' as const, label: t('pages.myRecords.tabs.recent'), icon: 'clock-bolt' },
	{
		value: 'personal-bests' as const,
		label: t('pages.myRecords.tabs.personalBests'),
		icon: 'star',
	},
	{
		value: 'world-records' as const,
		label: t('pages.myRecords.tabs.worldRecords'),
		icon: 'trophy',
	},
])
const sortOptions = computed(() => [
	{ value: 'latest' as const, label: t('pages.myRecords.sort.latest') },
	{ value: 'valuable-levels' as const, label: t('pages.myRecords.sort.valuableLevels') },
	{ value: 'valuable-pbs' as const, label: t('pages.myRecords.sort.valuablePbs') },
])
const tableLabels = computed(() => ({
	level: t('common.level'),
	player: t('common.user'),
	unknownPlayer: t('pages.records.table.unknownPlayer'),
	rank: t('common.rank'),
	time: t('common.time'),
	levelPoints: t('pages.myRecords.table.levelPoints'),
	points: t('common.points'),
	rankedPoints: t('pages.myRecords.table.rankedPoints'),
	date: t('pages.myRecords.table.set'),
	notRanked: t('pages.myRecords.table.notRanked'),
	decayPercentage: t('pages.myRecords.table.decayPercentage'),
	openRecord: t('pages.myRecords.table.openRecord'),
}))
const paginationLabels = computed(() => ({
	label: t('common.pagination'),
	loadingLabel: t('common.loading'),
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
const openRecord = (recordId: number) => navigateTo(`/record/${recordId}`)
</script>
