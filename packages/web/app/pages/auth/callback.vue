<template>
	<UContainer class="py-10">
		<UCard class="rounded-lg border-border bg-card/80">
			<h1 class="text-2xl font-semibold">
				{{ $t('auth.callback.title') }}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{{ $t('auth.callback.description') }}
			</p>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
usePageSeo('authCallback')

const { refresh } = await useCurrentUser()

onMounted(async () => {
	await refresh()
	await navigateTo('/')
})
</script>
