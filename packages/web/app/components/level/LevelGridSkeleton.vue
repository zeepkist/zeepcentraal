<template>
	<div
		class="grid gap-4 sm:grid-cols-2"
		:class="{
			'xl:grid-cols-3 2xl:grid-cols-4': columns === 4,
			'xl:grid-cols-3': columns === 3,
		}"
	>
		<div
			v-for="index in count"
			:key="index"
			class="overflow-hidden rounded-xl border border-border bg-card/60 p-4"
		>
			<USkeleton class="aspect-video w-full rounded-lg" />
			<div class="mt-4 space-y-3">
				<USkeleton class="h-6 w-3/4" />
				<USkeleton class="h-4 w-1/2" />
				<div class="grid grid-cols-3 gap-2 pt-2">
					<USkeleton v-for="metric in 3" :key="metric" class="h-12 rounded-lg" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
withDefaults(defineProps<{ columns?: 2 | 3 | 4; count?: number }>(), {
	columns: 3,
	count: 6,
})
</script>
