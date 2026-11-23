<script setup lang="ts">
</script>

<template>
	<PageContainer class="max-w-[100rem] py-2">
		<div class="2xl:ml-[19.5rem] 2xl:max-w-[80rem]">
			<slot name="header" />
		</div>
		<div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,80rem)]">
			<aside class="h-fit lg:sticky lg:top-22">
				<slot name="sidebar" />
			</aside>
			<main class="min-w-0">
				<slot />
			</main>
		</div>
	</PageContainer>
</template>
