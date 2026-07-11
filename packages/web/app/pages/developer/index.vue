<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="$t('pages.developer.eyebrow')" :title="$t('pages.developer.title')" :description="$t('pages.developer.description')" />
		<div class="grid gap-4 md:grid-cols-2">
			<UCard v-for="link in links" :key="link.to" class="rounded-xl border-border bg-card/85"><NuxtLink :to="link.to" class="flex items-start gap-3"><TablerIcon :name="link.icon" class="mt-1 text-primary" /><div><h2 class="font-bold">{{ link.title }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ link.description }}</p></div></NuxtLink></UCard>
		</div>
	</UContainer>
</template>
<script setup lang="ts">
usePageSeo('developer')
const { t } = useI18n()
const links = computed(() => [
	{
		to: '/developer/graphql',
		icon: 'code' as const,
		title: t('developer.graphql.title'),
		description: t('developer.graphql.description'),
	},
])
</script>
