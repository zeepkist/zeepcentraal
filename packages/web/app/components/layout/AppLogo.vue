<template>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		<NuxtImg
			src="/android-chrome-192x192.png"
			alt="ZeepCentraal"
			format="avif"
			width="32"
			height="32"
			densities="1x 2x"
			class="h-8 w-8 rounded-none bg-transparent"
		/>
		<span
			class="text-highlighted"
			:class="{
				'text-lg font-bold': large,
				'text-sm font-semibold': !large
			}"
		>
			ZeepCentraal
		</span>
	</div>
</template>

<script setup vapor lang="ts">
const { large } = defineProps<{
	large?: boolean
}>()
</script>
