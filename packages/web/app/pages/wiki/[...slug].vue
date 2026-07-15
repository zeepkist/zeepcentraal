<template>
	<ContentPage
		v-if="document"
		:eyebrow="$t('pages.wiki.eyebrow')"
		:document="document"
		:table-of-contents-title="$t('pages.wiki.tableOfContents')"
		show-table-of-contents
	/>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const path = computed(
	() =>
		`/wiki/${Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug}`,
)
const { data: document } = await useAsyncData(
	() => `wiki-${path.value}`,
	() => queryCollection('wiki').path(path.value).first(),
)
if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.wiki.notFound') })
}
useSeoMeta({ title: () => document.value?.title, description: () => document.value?.description })
</script>
