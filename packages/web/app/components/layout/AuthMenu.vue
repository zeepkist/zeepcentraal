<template>
	<UDropdownMenu :items="items">
		<UButton color="primary" variant="soft" size="sm">
			{{ session.user ? $t('auth.account') : $t('auth.signIn') }}
		</UButton>
	</UDropdownMenu>
</template>

<script setup lang="ts">
const { t } = useI18n()
const config = useRuntimeConfig()
const session = useSessionStore()

const items = computed(() => [
	[
		{
			label: t('auth.steam'),
			onSelect: () =>
				navigateTo(steamRedirectUrl(config.public.backendUrl), {
					external: true,
				}),
		},
		{
			label: t('auth.discord'),
			onSelect: () =>
				navigateTo(discordRedirectUrl(config.public.backendUrl), {
					external: true,
				}),
		},
	],
])
</script>
