<script setup lang="ts">
const props = defineProps<{ xxHash: string; viewerId?: number }>()
const { t } = useAppI18n()
const similar = useLevelSimilar(computed(() => props.xxHash), computed(() => props.viewerId))
const { levels, page, pagination, pending, error } = similar
const levelLabels = computed(() => ({
	adventureLabel: t('common.adventure'),
	pointsLabel: t('common.points'),
	recordsLabel: t('common.records'),
	personalBestsLabel: t('levels.card.personalBests'),
	ratingLabel: t('levels.card.rating'),
	unavailableLabel: t('levels.card.unavailable'),
	worldRecordLabel: t('levels.card.worldRecord'),
	authorTimeLabel: t('levels.card.authorTime'),
	byLabel: t('levels.card.by'),
	createdLabel: t('levels.card.created'),
}))
</script>

<template>
	<section :ref="similar.target" aria-labelledby="level-similar-heading" class="space-y-4">
		<SectionHeader id="level-similar-heading" :title="t('levels.detail.similar.title')" :description="t('levels.detail.similar.description')" />
		<DataState :pending="pending && levels.length === 0 && !error" :error="error" :empty="levels.length === 0" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('levels.detail.similar.empty')">
			<template #pending>
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<USkeleton v-for="index in 6" :key="index" class="h-64 rounded-2xl" />
				</div>
			</template>
			<LevelGrid :levels="levels" :transition-scope="`similar-levels-${xxHash}`" v-bind="levelLabels" />
		</DataState>
		<CursorPagination :page="page" :can-go-previous="pagination.canGoPrevious(page)" :can-go-next="pagination.canGoNext(page)" :pending="pending" :label="t('common.pagination')" :loading-label="t('common.loading')" :first-label="t('common.first')" :previous-label="t('common.previous')" :next-label="t('common.next')" :last-label="t('common.last')" @first="pagination.first()" @previous="pagination.previous(page)" @next="pagination.next(page)" @last="pagination.last()" />
	</section>
</template>
