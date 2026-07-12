Exit code: 0
Wall time: 0 seconds
Output:
<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.myRecords.eyebrow')"
			:title="$t('pages.myRecords.title')"
			:description="$t('pages.myRecords.description')"
		/>

		<MyRecordsTabs
			:model-value="view"
			:label="$t('pages.myRecords.tabs.label')"
			:options="tabOptions"
			@update:model-value="data.setView"
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
				:pending="data.countResult.fetching.value || data.result.fetching.value"
				:error="data.countResult.error.value?.message || data.result.error.value?.message"
				:empty="data.rows.value.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('pages.myRecords.empty')"
				:skeletons="6"
			>
				<MyRecordTable
					:records="data.rows.value"
					:labels="tableLabels"
					@select="openRecord"
				/>
			</DataState>
			<CursorPagination
				class="mt-4"
				:page="data.page.value"
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
const userId = computed(() => session.user?.id ?? -1)
const view = computed(() => normalizeMyRecordView(route.query.view))
const data = useMyRecords(userId, view)

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
const tableLabels = computed(() => ({
	level: t('common.level'),
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
	firstLabel: t('common.first'),
	previousLabel: t('common.previous'),
	nextLabel: t('common.next'),
	lastLabel: t('common.last'),
}))
const openRecord = (recordId: number) => navigateTo(`/record/${recordId}`)
</script>
