<script setup lang="ts">
usePageSeo('lobby')
</script>

<template>
	<LobbyShell>
		<template #navigationActions><LobbyRangeSelect live /></template>
		<LobbyStatisticsPanel live />
		<LobbyRoomBrowser />
	</LobbyShell>
</template>
