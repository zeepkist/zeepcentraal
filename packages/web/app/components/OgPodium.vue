<template>
	<div class="flex flex-col overflow-hidden rounded-2xl border border-[#292524] bg-[#171513]">
		<div
			v-for="(player, index) in players"
			:key="`${player.rank ?? index + 1}:${player.name}`"
			:class="compact ? 'px-4 py-2' : 'px-5 py-3'"
			class="flex items-center gap-4 border-b border-[#292524] last:border-b-0"
		>
			<div
				:class="compact ? 'h-8 w-8 text-[17px]' : 'h-9 w-9 text-[19px]'"
				class="flex shrink-0 items-center justify-center rounded-full bg-[#292524] font-black text-[#facc15] tabular-nums"
				style="font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
			>
				{{ player.rank ?? index + 1 }}
			</div>
			<div
				:class="compact ? 'text-[21px]' : 'text-[24px]'"
				class="min-w-0 flex-1 overflow-hidden font-bold"
			>
				{{ player.name }}
			</div>
			<div
				:class="compact ? 'text-[21px]' : 'text-[24px]'"
				class="shrink-0 font-black text-[#fafaf9] tabular-nums"
				style="font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1"
			>
				{{ player.points }}
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	compact?: boolean
	players: Array<{
		name: string
		points: string
		rank?: number
	}>
}>()
</script>
