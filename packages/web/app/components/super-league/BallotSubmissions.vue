<script setup lang="ts">
import type { SubmissionOverview } from '~/utils/superLeagueSubmission'

defineProps<{ overview: SubmissionOverview | null; pending: boolean; error: string | null }>()
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
	<ValidSubmissions v-if="overview?.contest" :contest="overview.contest" :overview="overview" :error="error"
		:show-download="false" @refresh="emit('refresh')" />
	<ContestLoading v-else-if="pending" label="Loading submitted levels" />
	<UAlert v-else-if="error" color="error" :title="error" :actions="[{ label: 'Try again', onClick: () => emit('refresh') }]" />
	<p v-else>No current contest voting period.</p>
</template>
