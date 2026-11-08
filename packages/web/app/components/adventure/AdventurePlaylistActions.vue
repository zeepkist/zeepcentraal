<script setup lang="ts">
import { adventurePlaylistPath } from '~/utils/adventurePlayerLevels'
import { findAdventureSeries } from '~/utils/adventureSeries'

const props = defineProps<{ series?: string; missingCount?: number; authenticated?: boolean }>()
const { t } = useAppI18n()
const toast = useToast()
const pending = shallowRef<string>()
const selectedSeries = computed(() => findAdventureSeries(props.series))

async function download(series?: string, missing = false) {
	const path = adventurePlaylistPath(series, missing)
	pending.value = path
	try {
		const blob = await $fetch<Blob>(path, { responseType: 'blob' })
		const url = URL.createObjectURL(blob)
		try {
			const link = document.createElement('a')
			link.href = url
			link.download = `zeepcentraal-adventure-${series ?? 'all'}${missing ? '-missing' : ''}.zeeplist`
			link.click()
		} finally { URL.revokeObjectURL(url) }
	} catch {
		toast.add({ title: t('adventure.leaderboard.downloadError'), color: 'error' })
	} finally { pending.value = undefined }
}
</script>

<template>
	<div class="flex flex-wrap items-center gap-2">
		<UButton v-if="selectedSeries" color="neutral" variant="soft" :loading="pending === adventurePlaylistPath(series)" :disabled="Boolean(pending)" @click="download(series)"><TablerIcon name="download" class="size-4" />{{ t('adventure.leaderboard.downloadSeries', { series: selectedSeries.key }) }}</UButton>
		<UButton color="neutral" variant="soft" :loading="pending === adventurePlaylistPath()" :disabled="Boolean(pending)" @click="download()"><TablerIcon name="download" class="size-4" />{{ t('adventure.leaderboard.downloadAll') }}</UButton>
		<UButton v-if="authenticated" color="primary" variant="soft" :loading="pending === adventurePlaylistPath(series, true)" :disabled="Boolean(pending) || !missingCount" @click="download(series, true)"><TablerIcon name="download" class="size-4" />{{ t('adventure.leaderboard.downloadMissing', { count: missingCount ?? 0 }) }}</UButton>
	</div>
</template>
