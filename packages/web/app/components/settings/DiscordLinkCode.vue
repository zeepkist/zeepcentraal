<script setup vapor lang="ts">
import { useClipboard, useIntervalFn, useNow } from '@vueuse/core'

const props = defineProps<{ code: string; expiresAt: string }>()
const emit = defineEmits<{ refresh: [] }>()
const now = useNow({
	scheduler: (update) => useIntervalFn(update, 1000),
})
const source = computed(() => props.code)
const { copy, copied } = useClipboard({ source })
const secondsLeft = computed(() =>
	Math.max(0, Math.ceil((new Date(props.expiresAt).getTime() - now.value.getTime()) / 1000)),
)
const expiresLabel = computed(() => {
	const minutes = Math.floor(secondsLeft.value / 60)
	const seconds = secondsLeft.value % 60
	return `${minutes}:${String(seconds).padStart(2, '0')}`
})
</script>

<template>
	<div class="rounded-xl border border-primary/25 bg-primary/5 p-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider text-muted">
					{{ $t('settings.discord.code.title') }}
				</p>
				<p class="mt-1 font-mono text-3xl font-bold tracking-[0.24em] text-highlighted">{{ code }}</p>
			</div>
			<UButton
				:label="
					copied
						? $t('settings.discord.code.copied')
						: $t('settings.discord.code.copy')
				"
				:icon="copied ? 'i-tabler-check' : 'i-tabler-copy'"
				color="neutral"
				variant="soft"
				@click="copy()"
			/>
		</div>
		<div class="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
			<span v-if="secondsLeft > 0">
				{{ $t('settings.discord.code.expiresIn', { time: expiresLabel }) }}
			</span>
			<span v-else class="text-error">{{ $t('settings.discord.code.expired') }}</span>
			<UButton
				v-if="secondsLeft === 0"
				:label="$t('settings.discord.code.regenerate')"
				variant="link"
				@click="emit('refresh')"
			/>
		</div>
	</div>
</template>
