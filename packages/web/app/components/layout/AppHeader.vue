<template>
	<UHeader
		:mode="'drawer'"
		data-testid="app-header"
		:ui="{ root: 'bg-warm-neutral-900/75 backdrop-blur' }"
	>
		<template #left>
			<div class="min-w-0" />
		</template>

		<template #right>
			<LocaleSwitcher />
			<ThemeToggle />
			<AuthMenu />
		</template>

		<template #body>
			<UNavigationMenu :items="mobileItems" orientation="vertical" class="lg:hidden" />
		</template>
	</UHeader>
</template>

<script setup lang="ts">
const { t } = useI18n()

const mobileItems = computed(() =>
	mainNav.map((item) => ({
		label: t(item.labelKey),
		to: item.to,
	})),
)
</script>
