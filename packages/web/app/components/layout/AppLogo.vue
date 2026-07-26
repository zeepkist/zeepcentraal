<template>
	<div class="flex min-w-0 flex-1 items-center gap-3">
		<img :src="Logo" alt="ZeepCentraal" class="h-8 w-8 rounded-none bg-transparent" />
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
import Logo from '@/assets/logo.png'

const { large } = defineProps<{
	large?: boolean
}>()
</script>
