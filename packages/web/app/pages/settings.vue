<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.settings.eyebrow')"
			:title="$t('pages.settings.title')"
			:description="$t('pages.settings.description')"
		/>
		<UAlert color="neutral" :title="$t('settings.account.title')" :description="$t('settings.account.description')">
			<template #icon><TablerIcon name="settings" /></template>
		</UAlert>
	</UContainer>
</template>

<script setup lang="ts">
usePageSeo('settings')
</script>
