<template>
	<div class="rounded-3xl border border-primary/20 bg-gradient-to-br from-card to-primary/10 p-8 text-center">
		<TablerIcon name="calendar-time" class="mx-auto size-12 text-primary" />
		<h1 class="mt-4 text-3xl font-black text-highlighted">{{ title }}</h1>
		<p class="mt-2 text-lg text-muted">
			{{ days > 0 ? $t('tournaments.startingInDays', { days }) : $t('tournaments.startingSoon') }}
		</p>
		<NuxtTime v-if="startAt" :datetime="startAt" class="mt-2 block text-sm text-muted" />
		<UButton v-if="backTo" :to="backTo" class="mt-6" color="neutral" variant="soft" icon="i-tabler-arrow-left">
			{{ $t('tournaments.backToActive') }}
		</UButton>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ title: string; startAt: string; backTo?: string }>()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const days = computed(() => Math.max(0, Math.ceil((Date.parse(props.startAt) - now.value) / 86_400_000)))
onMounted(() => {
	timer = setInterval(() => {
		now.value = Date.now()
	}, 60_000)
})
onScopeDispose(() => {
	if (timer) clearInterval(timer)
})
</script>
