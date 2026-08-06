<script setup vapor lang="ts">
usePageSeo('settings')
defineOgImage('Settings.takumi', { slug: 'settings' })
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('settings.discord.page.eyebrow')"
			:title="$t('settings.discord.page.title')"
			:description="$t('settings.discord.page.description')"
		/>
		<DiscordSettingsPanel />
	</UContainer>
</template>
