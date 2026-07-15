<template>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		<UAvatar src="/apple-touch-icon.png" alt="ZeepCentraal" :size="large ? 'lg' : 'md'" />
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
const { large } = withDefaults(
	defineProps<{
		large?: boolean
	}>(),
	{ large: false },
)
</script>
