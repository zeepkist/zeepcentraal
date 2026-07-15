<template>
	<UHeader
		:mode="'drawer'"
		data-testid="app-header"
		:ui="{ root: 'bg-warm-neutral-900/75 backdrop-blur' }"
	>
		<template #left>
			<div
				class="grid min-w-0 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none"
				:class="sidebarPreference ? 'grid-cols-[0fr]' : 'grid-cols-[1fr]'"
			>
				<div class="min-w-0 overflow-hidden">
					<AppLogo
						:aria-hidden="sidebarPreference"
						class="min-w-max origin-left transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
						:class="sidebarPreference ? 'pointer-events-none -translate-x-full opacity-0' : 'translate-x-0 opacity-100'"
					/>
				</div>
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

<script setup lang="ts">
import type { LocaleOption } from '~/types/app'
import { isNavigationTargetActive, mainNav } from '~/utils/navigation'
import { parseSidebarOpenPreference } from '~/utils/sidebarPreference'

const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { login, logout } = useAccountActions()
const omniSearch = useOmniSearch()
const sidebarPreference = useCookie<boolean | null>('sidebar-open', {
	default: () => null,
	maxAge: 60 * 60 * 24 * 365,
	path: '/',
	sameSite: 'lax',
})


const open = ref(sidebarPreference.value ?? true)

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
	placeholder: t('search.placeholder'),
	users: t('search.groups.users'),
	levels: t('search.groups.levels'),
	rank: t('search.rank'),
	points: t('common.points'),
	rating: t('levels.card.rating'),
	unknownAuthor: t('search.unknownAuthor'),
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
		active: isNavigationTargetActive(route.path, item.to),
	})),
)

watch(open, (value) => {
	sidebarPreference.value = value
})

function selectLocale(code: string) {
	void setLocale(code)
}
</script>
