<script setup vapor lang="ts">
const props = defineProps<{ levelId: number }>()
const memberships = useLevelWorkshops(computed(() => props.levelId))
const { result, workshops, page, pagination, active } = memberships
</script>

<template>
	<section :ref="memberships.target" aria-labelledby="level-workshop-heading" class="space-y-4">
		<SectionHeader id="level-workshop-heading" :title="$t('workshop.levelSection.title')" :description="$t('workshop.levelSection.description')" />
		<DataState :pending="pagination.isInitialPending(result.fetching.value, workshops.length, active)" :error="result.error.value?.message" :empty="workshops.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('workshop.levelSection.empty')">
			<WorkshopGrid :workshops="workshops" />
		</DataState>
		<WorkshopPagination :page="page" :pagination="pagination" :pending="!active || result.fetching.value" />
	</section>
</template>
