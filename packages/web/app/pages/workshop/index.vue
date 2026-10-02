<script setup vapor lang="ts">
usePageSeo('workshop')
const { search, author, sort, result, workshops, page, pagination, authorSuggestions, applyFilters } = useWorkshops()
</script>

<template>
	<ExplorerLayout>
		<template #header>
			<PageHeader :eyebrow="$t('pages.workshop.eyebrow')" :title="$t('pages.workshop.title')" :description="$t('pages.workshop.description')" />
		</template>
		<template #sidebar>
			<WorkshopFilterPanel v-model:search="search" v-model:author="author" v-model:sort="sort" :result-count="result.data.value?.workshopItems?.totalCount ?? 0" :author-suggestions="authorSuggestions.suggestions.value" :author-suggestions-pending="authorSuggestions.pending.value" @apply="applyFilters" />
		</template>
		<div class="min-w-0 space-y-6">
			<DataState :pending="pagination.isInitialPending(result.fetching.value, workshops.length)" :error="result.error.value?.message" :empty="workshops.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
				<WorkshopGrid :workshops="workshops" :columns="4" />
			</DataState>
			<WorkshopPagination :page="page" :pagination="pagination" :pending="result.fetching.value" />
		</div>
	</ExplorerLayout>
</template>
