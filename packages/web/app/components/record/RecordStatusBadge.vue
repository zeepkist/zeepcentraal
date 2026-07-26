<template>
	<UBadge v-if="status === 'world-record'" color="primary" variant="soft">
		{{ worldRecordLabel }}
	</UBadge>
	<UBadge
		v-else-if="status === 'personal-best'"
		color="neutral"
		variant="soft"
		class="bg-purple-500/15 text-purple-700 ring-purple-500/25 dark:bg-purple-400/15 dark:text-purple-300 dark:ring-purple-400/25"
	>
		{{ personalBestLabel }}
	</UBadge>
</template>

<script setup vapor lang="ts">
import type { RecordResultStatus } from '~/types/app'

defineProps<{
	status?: RecordResultStatus | null
	personalBestLabel: string
	worldRecordLabel: string
}>()
</script>
