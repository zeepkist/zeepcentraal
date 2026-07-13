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
			<LocaleSwitcher
				v-if="!session.user"
				:label="t('actions.locale')"
				:locale="locale"
				:options="localeOptions"
				@select="selectLocale"
			/>
			<ThemeToggle />
			<AuthMenu
				:user="session.user"
				:locale="locale"
				:locale-options="localeOptions"
				:labels="accountLabels"
				@locale="selectLocale"
				@logout="logout"
				@steam="login('steam')"
				@discord="login('discord')"
			/>
		</template>

		<template #body>
			<UNavigationMenu :items="mobileItems" orientation="vertical" class="lg:hidden" />
		</template>
	</UHeader>
</template>

<script setup lang="ts">
import type { LocaleOption } from '~/types/app'

const { t, locale, locales, setLocale } = useI18n()
const session = useSessionStore()
const { login, logout } = useAccountActions()

const localeOptions = computed<LocaleOption[]>(() =>
	locales.value.map((item) => ({ code: item.code, name: item.name ?? item.code })),
)
const accountLabels = computed(() => ({
	account: t('auth.account'),
	signIn: t('auth.signIn'),
	profile: t('auth.profile'),
	settings: t('auth.settings'),
	language: t('auth.language'),
	logout: t('auth.logout'),
	steam: t('auth.steam'),
	discord: t('auth.discord'),
}))
const mobileItems = computed(() =>
	mainNav.map((item) => ({ label: t(item.labelKey), to: item.to })),
)

function selectLocale(code: string) {
	void setLocale(code)
}
</script>
