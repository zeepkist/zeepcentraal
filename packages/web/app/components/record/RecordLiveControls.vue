<template>
	<div class="flex min-h-9 flex-wrap items-center justify-end gap-2">
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
		<UButton
			color="neutral"
			variant="soft"
			size="sm"
			:aria-label="soundEnabled ? labels.disableSound : labels.enableSound"
			:aria-pressed="soundEnabled"
			@click="$emit('update:soundEnabled', !soundEnabled)"
		>
			<TablerIcon :name="soundEnabled ? 'volume' : 'volume-off'" class="size-4" />
			<span class="hidden sm:inline">{{ soundEnabled ? labels.soundOn : labels.soundOff }}</span>
		</UButton>
		<USwitch
			v-if="showOnlyMine"
			:model-value="onlyMine"
			:label="labels.onlyMine"
			@update:model-value="$emit('update:onlyMine', Boolean($event))"
		/>
	</div>
</template>

<script setup vapor lang="ts">
import type { RecordLiveStatus } from '~/types/app'

const props = defineProps<{
	status: RecordLiveStatus
	labels: Record<RecordLiveStatus, string> & {
		enableSound: string
		disableSound: string
		soundOn: string
		soundOff: string
		onlyMine: string
	}
	soundEnabled: boolean
	showOnlyMine?: boolean
	onlyMine?: boolean
}>()

defineEmits<{
	'update:soundEnabled': [value: boolean]
	'update:onlyMine': [value: boolean]
}>()

const statusLabel = computed(() => props.labels[props.status])
</script>
