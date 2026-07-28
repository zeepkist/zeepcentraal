<template>
	<UContainer class="space-y-8 py-2 lg:space-y-10">
		<ModDetailHero v-if="data?.mod" :mod="data.mod" :by-label="byLabel" :labels="heroLabels" />
		<DataState
			v-else
			:pending="pending"
			:error="error"
			:empty="!pending && !data?.mod"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('mods.detail.notFound')"
			:skeletons="4"
		/>
		<template v-if="data?.mod">
			<ModDescription
				:title="$t('mods.detail.description')"
				:empty-label="$t('mods.detail.descriptionEmpty')"
				:description-html="data.mod.descriptionHtml"
			/>
			<section>
				<SectionHeader
					:title="$t('mods.detail.dependencies')"
					:description="$t('mods.detail.dependenciesDescription')"
				/>
				<ModGrid v-if="data.dependencies.length" :mods="data.dependencies" :labels="cardLabels" />
				<div v-else class="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
					{{ $t('mods.detail.noDependencies') }}
				</div>
			</section>
		</template>
	</UContainer>
</template>

<script setup vapor lang="ts">
import type { ModDetailResponse } from '~/types/mod'
import { normalizeModSlug } from '~/utils/modExplorer'

const route = useRoute()
const { t } = useI18n()
const slug = normalizeModSlug(route.params.slug)
if (!slug) throw createError({ statusCode: 404, statusMessage: t('mods.detail.notFound') })

const request = await useFetch<ModDetailResponse>(`/api/modio/mods/${slug}`, {
	query: { dependencies: 'true' },
	key: `mod-detail:${slug}`,
})
const data = request.data
const pending = computed(() => request.status.value === 'pending')
const error = computed(() => request.error.value?.message ?? null)
if (request.error.value?.statusCode === 404) {
	throw createError({ statusCode: 404, statusMessage: t('mods.detail.notFound') })
}

const byLabel = computed(() => t('mods.detail.by', { author: data.value?.mod.authorName ?? '' }))
const heroLabels = computed(() => ({
	version: t('mods.card.version'),
	size: t('mods.card.size'),
	downloads: t('mods.card.downloads'),
	subscribers: t('mods.detail.subscribers'),
	published: t('mods.detail.published'),
	updated: t('mods.detail.updated'),
	openModio: t('mods.detail.openModio'),
	unavailable: t('mods.card.unavailable'),
}))
const cardLabels = computed(() => ({
	versionLabel: t('mods.card.version'),
	sizeLabel: t('mods.card.size'),
	downloadsLabel: t('mods.card.downloads'),
	ratingLabel: t('mods.card.rating'),
	updatedLabel: t('mods.card.updated'),
	openModioLabel: t('mods.card.openModio'),
	unavailableLabel: t('mods.card.unavailable'),
}))

const title = computed(() => data.value?.mod.name ?? t('pages.mods.seo.title'))
const description = computed(() =>
	data.value?.mod
		? t('mods.detail.seoDescription', { name: data.value.mod.name })
		: t('pages.mods.seo.description'),
)
useSeoMeta({
	title: () => title.value,
	description,
	ogTitle: title,
	ogDescription: description,
	twitterCard: 'summary_large_image',
})
useSchemaOrg([defineWebPage({ name: title, description })])
defineOgImage('ModDetail.takumi', { slug })
</script>
