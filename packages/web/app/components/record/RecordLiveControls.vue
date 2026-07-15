<template>
	<div class="flex min-h-9 items-center">
		<UBadge :color="status === 'live' ? 'success' : 'neutral'" variant="soft" size="lg">
			<span class="relative mr-1.5 flex size-2" aria-hidden="true">
				<span
					v-if="status === 'live'"
					class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70 motion-reduce:animate-none"
				/>
				<span
					class="relative inline-flex size-2 rounded-full"
					:class="status === 'live' ? 'bg-success' : 'bg-muted-foreground/60'"
				/>
			</span>
			{{ statusLabel }}
		</UBadge>
	</div>
</template>

<script setup lang="ts">
import type { RecordLiveStatus } from '~/types/app'

const props = defineProps<{
	status: RecordLiveStatus
	labels: Record<RecordLiveStatus, string>
}>()

const statusLabel = computed(() => props.labels[props.status])
</script>
