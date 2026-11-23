import type { DropdownMenuItem } from '@nuxt/ui'
import type { LocaleOption, SessionUser } from '~/types/app'

export type AccountMenuLabels = {
	account: string
	signIn: string
	profile: string
	settings: string
	language: string
	admin: string
	ghostValidation: string
	zslManagement: string
	logout: string
	steam: string
	discord: string
}

type AccountMenuInput = {
	user: SessionUser | null
	isAdmin: boolean
	locale: string
	localeOptions: LocaleOption[]
	labels: AccountMenuLabels
	onLocale: (code: string) => void
	onLogout: () => void
	onSteam: () => void
	onDiscord: () => void
}

export function buildAccountMenuItems(input: AccountMenuInput): DropdownMenuItem[][] {
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
			...(input.isAdmin === true
				? [
						{
							label: input.labels.admin,
							slot: 'admin',
							children: [
								{
									label: input.labels.ghostValidation,
									slot: 'ghost-validation',
									to: '/admin/ghost-validation',
								},
								{
									label: input.labels.zslManagement,
									slot: 'zsl-management',
									to: '/admin/zsl',
								},
							],
						},
					]
				: []),
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
