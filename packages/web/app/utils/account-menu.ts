import type { LocaleOption, SessionUser } from '~/types/app'

export type AccountMenuLabels = {
	account: string
	signIn: string
	profile: string
	settings: string
	language: string
	logout: string
	steam: string
	discord: string
}

type AccountMenuInput = {
	user: SessionUser | null
	locale: string
	localeOptions: LocaleOption[]
	labels: AccountMenuLabels
	onLocale: (code: string) => void
	onLogout: () => void
	onSteam: () => void
	onDiscord: () => void
}

export function buildAccountMenuItems(input: AccountMenuInput) {
	if (!input.user) {
		return [
			[
				{ label: input.labels.steam, slot: 'steam', onSelect: input.onSteam },
				{ label: input.labels.discord, slot: 'discord', onSelect: input.onDiscord },
			],
		]
	}

	return [
		[{ label: input.user.steamName ?? input.user.steamId, type: 'label' as const }],
		[
			{
				label: input.labels.profile,
				to: `/user/${input.user.steamId}`,
				slot: 'profile',
			},
			{ label: input.labels.settings, to: '/settings', slot: 'settings' },
			{
				label: input.labels.language,
				slot: 'language',
				children: input.localeOptions.map((option) => ({
					label: option.name,
					type: 'checkbox' as const,
					checked: option.code === input.locale,
					onSelect: () => input.onLocale(option.code),
				})),
			},
		],
		[
			{
				label: input.labels.logout,
				color: 'error' as const,
				slot: 'logout',
				onSelect: input.onLogout,
			},
		],
	]
}
