<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :title="$t('pages.developer.title')" :description="$t('pages.developer.description')" />
		<div class="grid gap-4 md:grid-cols-2">
			<DeveloperResourceCard v-for="link in links" :key="link.to" v-bind="link" />
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
	{
		to: 'https://discord.gg/zeepkist-modding',
		icon: 'brand-discord' as const,
		title: t('developer.moddingDiscord.title'),
		description: t('developer.moddingDiscord.description'),
		external: true,
	},
])
</script>
