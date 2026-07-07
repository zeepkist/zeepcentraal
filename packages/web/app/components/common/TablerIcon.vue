<template>
	<component :is="iconComponent" aria-hidden="true" class="size-5 shrink-0" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type TablerIconName, tablerIcons } from '~/utils/icons'

const props = defineProps<{
	name: string
}>()

const iconComponent = computed(
	() => tablerIcons[props.name as TablerIconName] ?? tablerIcons.dashboard,
)
</script>
