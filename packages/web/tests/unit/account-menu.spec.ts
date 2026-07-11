import { describe, expect, test, vi } from 'vitest'
import { buildAccountMenuItems } from '../../app/utils/account-menu'
import { tablerIcons } from '../../app/utils/icons'

const labels = {
	account: 'Account',
	signIn: 'Sign in',
	profile: 'View profile',
	settings: 'Settings',
	language: 'Language',
	logout: 'Log out',
	steam: 'Sign in with Steam',
	discord: 'Sign in with Discord',
}
const callbacks = {
	onLocale: vi.fn(),
	onLogout: vi.fn(),
	onSteam: vi.fn(),
	onDiscord: vi.fn(),
}

describe('account menu model', () => {
	test('provides login providers while logged out', () => {
		const items = buildAccountMenuItems({
			user: null,
			locale: 'en',
			localeOptions: [],
			labels,
			...callbacks,
		})
		expect(items[0]?.map((item) => item.label)).toEqual([labels.steam, labels.discord])
	})

	test('provides player, profile, settings, language submenu, and logout while logged in', () => {
		const items = buildAccountMenuItems({
			user: { id: 7, steamId: '76561198000000000', steamName: 'Player' },
			locale: 'en',
			localeOptions: [
				{ code: 'en', name: 'English' },
				{ code: 'nl', name: 'Nederlands' },
			],
			labels,
			...callbacks,
		})
		expect(items[0]?.[0]?.label).toBe('Player')
		expect(items[1]?.[0]).toMatchObject({ to: '/user/76561198000000000', slot: 'profile' })
		expect(items[1]?.[1]).toMatchObject({ to: '/settings', slot: 'settings' })
		expect(items[1]?.[2]).toMatchObject({ slot: 'language' })
		expect(items[1]?.[2]?.children).toHaveLength(2)
		expect(items[2]?.[0]).toMatchObject({ color: 'error', slot: 'logout' })
	})

	test('uses distinct Tabler login and account icons', () => {
		expect(tablerIcons.login).not.toBe(tablerIcons['user-circle'])
	})
})
