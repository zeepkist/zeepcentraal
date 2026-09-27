<script setup vapor lang="ts">
const props = defineProps<{ roundIds?: number[] }>()
const { snapshot } = useSuperLeagueVote()
const visible = computed(() => !!snapshot.value?.openTypes.length
	&& (!props.roundIds || props.roundIds.includes(snapshot.value.roundId)))
</script>

<template>
	<UButton v-if="visible" to="/super-league/vote" icon="i-tabler-notes" size="lg">Vote for levels</UButton>
</template>
