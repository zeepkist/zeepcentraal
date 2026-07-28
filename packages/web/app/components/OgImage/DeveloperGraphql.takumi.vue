<template>
	<OgFrame
		style="font-family: DINish"
		:eyebrow="$t('nav.developer')"
		:title="title"
		:description="description"
	>
		<OgBreadcrumbs :items="breadcrumbs" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{ slug: string }>()

const { t } = useI18n()
const { data: document } = await useAsyncData(`og-developer-graphql:${props.slug}`, () =>
	queryCollection('developer').path('/developer/graphql').first(),
)
const title = document.value?.title ?? t('pages.graphql.seo.title')
const description = document.value?.description ?? t('pages.graphql.seo.description')
const breadcrumbs = [t('pages.developer.breadcrumb'), title]
</script>
