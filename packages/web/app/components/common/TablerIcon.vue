<template>
	<component :is="iconComponent" aria-hidden="true" class="size-5 shrink-0" />
</template>

<script setup vapor lang="ts">
import { computed } from 'vue'
import { type TablerIconName, tablerIcons } from '~/utils/icons'

const props = defineProps<{
	name: TablerIconName
}>()

if (!tablerIcons[props.name]) {
	console.warn(`TablerIcon: Icon "${props.name}" not found.`)
}

const iconComponent = computed(() => tablerIcons[props.name] ?? tablerIcons.dashboard)
</script>
