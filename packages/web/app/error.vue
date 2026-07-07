<template>
	<UApp>
		<UContainer class="grid min-h-dvh place-items-center py-10">
			<UCard class="w-full max-w-xl rounded-lg border-border bg-card/80">
				<h1 class="text-3xl font-bold">
					{{ $t('error.title') }}
				</h1>
				<p class="mt-3 text-muted-foreground">
					{{ $t('error.description') }}
				</p>
				<UButton class="mt-6" to="/">
					{{ $t('error.action') }}
				</UButton>
			</UCard>
		</UContainer>
	</UApp>
</template>

<script setup lang="ts">
defineProps<{
	error: {
		statusCode?: number
		message?: string
	}
}>()
</script>
