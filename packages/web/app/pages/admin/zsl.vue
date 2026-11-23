<script setup lang="ts">
import ZslEditor from '~/components/admin/ZslEditor.vue'

const { t } = useAppI18n()
useSeoMeta({ title: () => t('auth.zslManagement'), robots: 'noindex, nofollow' })
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :title="t('auth.zslManagement')" description="Manage Super League rounds, seasons, points structures, and playlists." />
		<ZslEditor />
	</UContainer>
</template>
