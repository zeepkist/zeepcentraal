import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const settingsIndex = readFileSync(
	new URL('../../app/pages/settings/index.vue', import.meta.url),
	'utf8',
)
const discordPage = readFileSync(
	new URL('../../app/pages/settings/discord.vue', import.meta.url),
	'utf8',
)
const settingsPanel = readFileSync(
	new URL('../../app/components/settings/DiscordSettingsPanel.vue', import.meta.url),
	'utf8',
)
const linkCode = readFileSync(
	new URL('../../app/components/settings/DiscordLinkCode.vue', import.meta.url),
	'utf8',
)
const settingsComposable = readFileSync(
	new URL('../../app/composables/useDiscordSettings.ts', import.meta.url),
	'utf8',
)
const localeSource = readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8')
const locale = JSON.parse(localeSource) as {
	settings: {
		discord: {
			account: { addToServer: string; description: string }
			overview: { description: string }
			page: { description: string }
			toasts: { linked: { description: string } }
		}
	}
}

describe('Discord settings', () => {
	test('uses explicit VueUse imports and current countdown scheduler API', () => {
		expect(linkCode).toContain(
			"import { useClipboard, useIntervalFn, useNow } from '@vueuse/core'",
		)
		expect(linkCode).toContain('scheduler: (update) => useIntervalFn(update, 1000)')
		expect(linkCode).not.toContain('useNow({ interval:')
	})

	test('keeps the full settings flow in English i18n', () => {
		expect(settingsIndex).toContain("$t('settings.discord.overview.description')")
		expect(discordPage).toContain("$t('settings.discord.page.description')")
		expect(settingsPanel).toContain("$t('settings.discord.account.description')")
		expect(settingsPanel).toContain('keypath="settings.discord.manual.description"')
		expect(linkCode).toContain("$t('settings.discord.code.expiresIn'")
		expect(settingsComposable).toContain('const { t } = useI18n()')
		expect(settingsComposable).toContain("t('settings.discord.toasts.linked.description')")
	})

	test('uses Tabler icons throughout the Discord settings flow', () => {
		const discordUi = [settingsIndex, settingsPanel, linkCode].join('\n')
		expect(discordUi).not.toMatch(/i-(?:lucide|simple-icons)-/)
		expect(discordUi).toContain('i-tabler-arrow-right')
		expect(discordUi).toContain('i-tabler-brand-steam')
		expect(discordUi).toContain('i-tabler-brand-discord')
		expect(discordUi).toContain('i-tabler-unlink')
		expect(discordUi).toContain('i-tabler-key')
		expect(discordUi).toContain('i-tabler-check')
		expect(discordUi).toContain('i-tabler-copy')
	})

	test('links the companion bot install action to Discord', () => {
		expect(locale.settings.discord.account.addToServer).toBe('Add ZeepCentraal to your server')
		expect(settingsPanel).toContain(
			'to="https://discord.com/oauth2/authorize?client_id=1398745142260797571"',
		)
		expect(settingsPanel).toContain('target="_blank"')
		expect(settingsPanel).toContain('rel="noopener"')
	})

	test('leads with Discord sign-in and companion bot benefits', () => {
		expect(locale.settings.discord.overview.description).toBe(
			'Sign in to ZeepCentraal with Discord and unlock extended companion bot features.',
		)
		expect(locale.settings.discord.page.description).toBe(
			'Connect your Discord account to sign in to ZeepCentraal and unlock extended companion bot features.',
		)
		expect(locale.settings.discord.account.description).toBe(
			"Access your ZeepCentraal profile through Discord's user context menu, create playlists tailored to you, and more.",
		)
		expect(locale.settings.discord.toasts.linked.description).toBe(
			'You can now sign in to ZeepCentraal with Discord and use extended companion bot features.',
		)
	})

	test('removes rejected account-linking copy', () => {
		const discordCopy = [
			settingsIndex,
			discordPage,
			settingsPanel,
			settingsComposable,
			localeSource,
		].join('\n')

		expect(discordCopy).not.toContain('personal bot commands')
		expect(discordCopy).not.toContain('verified account ownership')
		expect(discordCopy).not.toContain('server roles')
		expect(discordCopy).not.toContain('linked roles')
	})
})
