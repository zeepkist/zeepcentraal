<script setup vapor lang="ts">
usePageSeo('playlist')
</script>

<template>
	<UContainer class="max-w-none py-4 sm:py-6">
		<PageHeader
			:eyebrow="$t('pages.playlist.eyebrow')"
			:title="$t('pages.playlist.title')"
			:description="$t('pages.playlist.description')"
		/>
		<PlaylistWorkspace />
	</UContainer>
</template>
