<script setup lang="ts">
usePageSeo('lobby')
</script>

<template>
	<LobbyShell>
		<template #navigationActions><LobbyRangeSelect /></template>
		<LobbyStatisticsPanel />
	</LobbyShell>
</template>
