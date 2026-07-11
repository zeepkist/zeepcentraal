<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="$t('pages.wiki.eyebrow')" :title="$t('pages.wiki.title')" :description="$t('pages.wiki.description')" />
		<ContentDocument v-if="document" :document="document" />
	</UContainer>
</template>
<script setup lang="ts">
usePageSeo('wiki')
const { data: document } = await useAsyncData('wiki-index', () =>
	queryCollection('wiki').path('/wiki').first(),
)
</script>
