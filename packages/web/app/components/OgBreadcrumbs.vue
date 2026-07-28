<template>
	<div class="flex flex-wrap items-center gap-3 text-[24px] font-bold text-[#a8a29e]">
		<template v-for="(item, index) in items" :key="`${index}:${item}`">
			<span v-if="index > 0" class="text-[#57534e]">/</span>
			<span :class="{ 'text-[#facc15]': index === items.length - 1 }">{{ item }}</span>
		</template>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	items: string[]
}>()
</script>
