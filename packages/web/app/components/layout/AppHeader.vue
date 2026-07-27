<template>
	<UHeader
		v-model:open="mobileDrawerOpen"
		:mode="'drawer'"
		data-testid="app-header"
		:ui="{ root: 'bg-warm-neutral-900/75 backdrop-blur' }"
	>
		<template #left>
			<div class="relative h-8 w-40 shrink-0 overflow-hidden">
				<Transition
					enter-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none"
					enter-from-class="-translate-x-2 opacity-0"
					enter-to-class="translate-x-0 opacity-100"
					leave-active-class="transition-[transform,opacity] duration-75 ease-in motion-reduce:transition-none"
					leave-from-class="translate-x-0 opacity-100"
					leave-to-class="-translate-x-2 opacity-0"
				>
					<AppLogo
						v-if="showHeaderLogo"
						class="absolute inset-0 h-8 w-40 transform-gpu will-change-transform"
					/>
				</Transition>
			</div>
		</template>

		<HeaderOmniSearch
			id="desktop-omni-search"
			:query="omniSearch.search.value"
			:users="omniSearch.users.value"
			:levels="omniSearch.levels.value"
			:pending="omniSearch.pending.value"
			:error="Boolean(omniSearch.error.value)"
			:locale="locale"
			:labels="searchLabels"
			class="w-full min-w-72 max-w-xl"
			@update:query="omniSearch.search.value = $event"
			@select="omniSearch.select"
		/>

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
			<HeaderOmniSearch
				v-if="mobileDrawerOpen"
				id="mobile-omni-search"
				:query="omniSearch.search.value"
				:users="omniSearch.users.value"
				:levels="omniSearch.levels.value"
				:pending="omniSearch.pending.value"
				:error="Boolean(omniSearch.error.value)"
				:locale="locale"
				:labels="searchLabels"
				class="mb-5 w-full"
				@update:query="omniSearch.search.value = $event"
				@select="omniSearch.select"
			/>
			<UNavigationMenu :items="mobileItems" orientation="vertical" class="lg:hidden" />
		</template>
	</UHeader>
</template>

<script setup vapor lang="ts">
import type { LocaleOption } from '~/types/app'
import { isNavigationTargetActive, mainNav } from '~/utils/navigation'

const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const session = useSessionStore()
const mobileDrawerOpen = ref(false)
const { login, logout } = useAccountActions()
const omniSearch = useOmniSearch()
const sidebarPreference = useCookie<boolean | null>('sidebar-open', {
	default: () => null,
	maxAge: 60 * 60 * 24 * 365,
	path: '/',
	readonly: true,
	sameSite: 'lax',
	watch: false,
})
const showHeaderLogo = computed(() => sidebarPreference.value === false)

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
const searchLabels = computed(() => ({
	label: t('search.label'),
	placeholder: t('search.label'),
	users: t('search.groups.users'),
	levels: t('search.groups.levels'),
	rank: t('common.rank'),
	points: t('common.points'),
	rating: t('levels.card.rating'),
	unknownAuthor: t('common.unknownAuthor'),
	unavailable: t('levels.card.unavailable'),
	typeMore: t('search.typeMore'),
	empty: t('search.empty'),
	loading: t('search.loading'),
	error: t('search.error'),
}))
const mobileItems = computed(() =>
	mainNav.map((item) => ({
		label: t(item.labelKey),
		to: item.to,
		prefetchOn: item.prefetchOn,
		active: isNavigationTargetActive(route.path, item.to),
	})),
)

function selectLocale(code: string) {
	if (!locales.value.some((locale) => locale.code === code)) return
	void setLocale(code as Parameters<typeof setLocale>[0])
}
</script>
