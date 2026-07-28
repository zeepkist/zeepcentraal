<template>
	<div class="flex flex-wrap gap-3">
		<div
			v-for="item in items"
			:key="item.label"
			:class="compact ? 'px-4 py-2' : 'px-5 py-3'"
			class="flex min-w-56 flex-1 flex-col rounded-2xl border border-[#292524] bg-[#171513]"
		>
			<div
				:class="compact ? 'text-[24px]' : 'text-[26px]'"
				class="font-black leading-none text-[#fafaf9] tabular-nums"
				style="font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
			>
				{{ item.value }}
			</div>
			<div
				:class="compact ? 'mt-1 text-[14px]' : 'mt-2 text-[15px]'"
				class="font-bold uppercase tracking-[0.08em] text-[#78716c]"
			>
				{{ item.label }}
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	compact?: boolean
	items: Array<{
		label: string
		value: string
	}>
}>()
</script>
