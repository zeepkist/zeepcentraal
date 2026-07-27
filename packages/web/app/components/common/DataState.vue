<template>
	<div>
		<div v-if="pending" class="grid gap-3" role="status" :aria-label="loadingLabel">
			<slot name="pending">
				<USkeleton v-for="index in skeletons" :key="index" class="h-20 w-full" />
			</slot>
		</div>
		<UAlert v-else-if="error" color="error" :title="errorTitle" :description="error">
			<template #icon><TablerIcon name="exclamation-circle" /></template>
		</UAlert>
		<div v-else-if="empty" class="grid place-items-center gap-3 rounded-xl border border-border p-8 text-center">
			<TablerIcon name="ghost-2" class="size-8 text-muted-foreground" />
			<p class="font-medium">{{ emptyTitle }}</p>
		</div>
		<slot v-else />
	</div>
</template>

<script setup vapor lang="ts">
withDefaults(
	defineProps<{
		pending?: boolean
		error?: string | null
		empty?: boolean
		loadingLabel: string
		errorTitle: string
		emptyTitle: string
		skeletons?: number
	}>(),
	{ pending: false, error: null, empty: false, skeletons: 3 },
)
</script>
