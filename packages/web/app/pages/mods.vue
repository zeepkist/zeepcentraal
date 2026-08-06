<template>
	<ExplorerLayout>
		<template #header>
			<PageHeader
				:eyebrow="$t('pages.mods.eyebrow')"
				:title="$t('pages.mods.title')"
				:description="$t('pages.mods.description')"
			/>
		</template>
		<template #sidebar>
			<div class="space-y-4">
				<ModFilterPanel
					:title="$t('mods.filters.title')"
					:result-count-label="$t('mods.results', { count: data?.total ?? 0 })"
					:search="search"
					:sort="sort"
					:essentials-only="essentialsOnly"
					:tags="tags"
					:tag-options="tagOptions"
					:tag-options-pending="tagOptionsPending"
					:search-label="$t('mods.filters.search')"
					:search-placeholder="$t('mods.filters.searchPlaceholder')"
					:sort-label="$t('mods.filters.sort')"
					:essentials-only-label="$t('mods.filters.essentialsOnly')"
					:tags-label="$t('mods.filters.tags')"
					:tags-placeholder="$t('mods.filters.tagsPlaceholder')"
					:apply-label="$t('mods.filters.apply')"
					:sort-options="sortOptions"
					@update:search="search = $event"
					@update:sort="sort = $event as ModSort"
					@update:essentials-only="essentialsOnly = $event"
					@update:tags="tags = $event"
					@apply="applyFilters"
				/>
				<ModkistPromoCard
					v-if="showModkistPromo"
					:eyebrow="$t('mods.modkistPromo.eyebrow')"
					:title="$t('mods.modkistPromo.title')"
					:description="$t('mods.modkistPromo.description')"
					:download-label="$t('mods.modkistPromo.download')"
					download-href="/api/downloads/modkist/stable/msi"
					:guide-label="$t('mods.modkistPromo.guide')"
					guide-href="/wiki/setup-modkist"
				/>
			</div>
		</template>
		<div class="min-w-0 space-y-6">
			<DataState
				:pending="pending && !data"
				:error="error"
				:empty="(data?.items.length ?? 0) === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('mods.empty')"
				:skeletons="8"
			>
				<ModGrid
					:mods="data?.items ?? []"
					:labels="cardLabels"
					transition-scope="mods-explorer"
				/>
			</DataState>
			<CursorPagination
				:page="page"
				:can-go-previous="page.hasPreviousPage"
				:can-go-next="page.hasNextPage"
				:pending="pending"
				:label="$t('common.pagination')"
				:loading-label="$t('common.loading')"
				:first-label="$t('common.first')"
				:previous-label="$t('common.previous')"
				:next-label="$t('common.next')"
				:last-label="$t('common.last')"
				@first="first"
				@previous="previous"
				@next="next"
				@last="last"
			/>
		</div>
	</ExplorerLayout>
</template>

<script setup vapor lang="ts">
import { useQuery } from '@urql/vue'
import { Zc_MyRecordCountDocument } from '@zeepkist/graphql/generated'
import { MOD_SORTS, type ModSort } from '~/types/mod'
import { shouldShowModkistPromo } from '~/utils/modkistPromo'

usePageSeo('mods')
defineOgImage('ModExplorer.takumi', { slug: 'mods' })
const { t } = useI18n()
const session = useSessionStore()
const viewerId = computed(() => session.user?.id)
const recordCountQuery = useQuery({
	query: Zc_MyRecordCountDocument,
	variables: computed(() => ({ id: viewerId.value ?? -1 })),
	pause: computed(() => viewerId.value === undefined),
})

if (viewerId.value !== undefined) await recordCountQuery

const showModkistPromo = computed(() =>
	shouldShowModkistPromo(
		session.user !== null,
		recordCountQuery.data.value?.records?.totalCount,
	),
)
const {
	applyFilters,
	data,
	error,
	essentialsOnly,
	first,
	last,
	next,
	page,
	pending,
	previous,
	search,
	sort,
	tagOptions,
	tagOptionsPending,
	tags,
} = await useMods()

const sortOptions = computed(() => [
	{ label: t('mods.sort.popular'), value: MOD_SORTS.popular },
	{ label: t('mods.sort.updated'), value: MOD_SORTS.updated },
	{ label: t('mods.sort.newest'), value: MOD_SORTS.newest },
	{ label: t('mods.sort.downloadsToday'), value: MOD_SORTS.downloadsToday },
	{ label: t('mods.sort.downloadsTotal'), value: MOD_SORTS.downloadsTotal },
	{ label: t('mods.sort.subscribers'), value: MOD_SORTS.subscribers },
	{ label: t('mods.sort.rating'), value: MOD_SORTS.rating },
	{ label: t('mods.sort.nameAsc'), value: MOD_SORTS.nameAsc },
	{ label: t('mods.sort.nameDesc'), value: MOD_SORTS.nameDesc },
])
const cardLabels = computed(() => ({
	versionLabel: t('mods.card.version'),
	sizeLabel: t('mods.card.size'),
	downloadsLabel: t('mods.card.downloads'),
	ratingLabel: t('mods.card.rating'),
	updatedLabel: t('mods.card.updated'),
	openModioLabel: t('mods.card.openModio'),
	unavailableLabel: t('mods.card.unavailable'),
}))
</script>
