<template>
	<tr
		class="group border-t border-border transition-colors hover:bg-primary/8"
		:class="[
			viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60',
			pinned ? 'border-t-2 border-primary/40' : '',
			interactive ? 'cursor-pointer' : '',
			{ 'record-history-highlight': highlighted },
		]"
	>
		<slot />
	</tr>
</template>

<script setup vapor lang="ts">
defineProps<{
	viewer?: boolean
	pinned?: boolean
	interactive?: boolean
	highlighted?: boolean
}>()
</script>
