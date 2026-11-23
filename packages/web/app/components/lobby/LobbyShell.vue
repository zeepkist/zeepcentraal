<script setup lang="ts">
import { lobbyLabel } from '~/utils/lobbyLabels'

const { t } = useAppI18n()
</script>

<template>
	<PageContainer class="max-w-7xl space-y-6 py-2">
		<PageHeader :eyebrow="t('pages.lobby.eyebrow')" :title="t('pages.lobby.title')" :description="t('pages.lobby.description')" />
		<nav class="flex flex-wrap gap-2" :aria-label="t('lobby.analytics.navigation')">
			<UButton v-for="item in [{ to: '/lobby', key: 'live' }, { to: '/lobby/stats', key: 'statistics' }, { to: '/lobby/history', key: 'history' }]" :key="item.to" :to="item.to" color="neutral" variant="soft" active-class="ring-2 ring-primary" exact>{{ t(lobbyLabel(item.key)) }}</UButton>
		</nav>
		<slot />
	</PageContainer>
</template>
