<script setup vapor lang="ts">
const route = useRoute()
const { t } = useI18n()
const session = useSessionStore()
const workshopId = computed(() => String(route.params.workshopId))
const { detail, workshop, result, levels, page, pagination, validId } = useWorkshopDetail(workshopId, computed(() => session.user?.id))
const title = computed(() => workshop.value?.name ?? t('pages.workshop.seo.title'))
const description = computed(() => workshop.value ? t('workshop.detail.seoDescription', { name: workshop.value.name }) : t('pages.workshop.seo.description'))
useSeoMeta({
	title,
	ogTitle: title,
	twitterTitle: title,
	description,
	ogDescription: description,
	twitterDescription: description,
	ogImage: () => workshop.value?.imageUrl ?? undefined,
	twitterImage: () => workshop.value?.imageUrl ?? undefined,
	twitterCard: 'summary_large_image',
})
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
	<UContainer class="py-2">
		<DataState :pending="validId && detail.fetching.value" :error="validId ? detail.error.value?.message : null" :empty="!workshop" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('workshop.detail.notFound')">
			<div v-if="workshop" class="space-y-8 lg:space-y-10">
				<WorkshopDetailHero :workshop="workshop" />
				<section aria-labelledby="workshop-levels-heading" class="space-y-4">
					<SectionHeader id="workshop-levels-heading" :title="$t('workshop.detail.levelsTitle')" :description="$t('workshop.detail.levelsDescription', { count: result.data.value?.levels?.totalCount ?? 0 })" />
					<DataState :pending="pagination.isInitialPending(result.fetching.value, levels.length)" :error="result.error.value?.message" :empty="levels.length === 0" :loading-label="$t('common.loading')" :error-title="$t('common.error')" :empty-title="$t('common.empty')">
						<LevelGrid :levels="levels" :transition-scope="`workshop-levels-${workshopId}`" v-bind="levelLabels" />
					</DataState>
					<WorkshopPagination :page="page" :pagination="pagination" :pending="result.fetching.value" />
				</section>
			</div>
		</DataState>
	</UContainer>
</template>
