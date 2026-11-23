<script setup lang="ts">
const ui = { base: () => 'w-full max-w-(--ui-container) mx-auto' }
</script>

<template>
	<UContainer :ui="ui">
		<slot />
	</UContainer>
</template>
