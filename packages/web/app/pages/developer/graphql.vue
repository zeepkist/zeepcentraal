<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="$t('pages.graphql.eyebrow')" :title="$t('pages.graphql.title')" :description="$t('pages.graphql.description')" />
		<ContentDocument v-if="document" :document="document" />
	</UContainer>
</template>
<script setup lang="ts">
usePageSeo('graphql')
const { data: document } = await useAsyncData('developer-graphql', () =>
	queryCollection('api').path('/api').first(),
)
</script>
