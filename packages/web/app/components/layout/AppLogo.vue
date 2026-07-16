<template>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		<UAvatar src="/apple-touch-icon.png" alt="ZeepCentraal" :size="large ? 'xl' : 'lg'" class="rounded-none bg-transparent" />
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

<script setup lang="ts">
const { large } = defineProps<{
	large?: boolean
}>()
</script>
