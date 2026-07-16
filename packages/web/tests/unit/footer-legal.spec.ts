import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const footer = readFileSync(
	new URL('../../app/components/layout/AppFooter.vue', import.meta.url),
	'utf8',
)
const contentConfig = readFileSync(new URL('../../content.config.ts', import.meta.url), 'utf8')
const terms = readFileSync(new URL('../../content/legal/terms.md', import.meta.url), 'utf8')
const privacy = readFileSync(new URL('../../content/legal/privacy.md', import.meta.url), 'utf8')
const en = JSON.parse(
	readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
) as {
	footer: Record<string, unknown>
	pages: Record<string, unknown>
}

describe('footer and legal pages', () => {
	test('uses NuxtUI footer columns with requested destinations', () => {
		expect(footer).toContain('<UFooter')
		expect(footer).toContain('<UFooterColumns')
		expect(footer).toContain("'/terms'")
		expect(footer).toContain("'/privacy'")
		expect(footer).toContain('https://github.com/zeepkist/zeepcentraal')
		expect(footer).toContain('https://discord.gg/WjRuWGRnGp')
		expect(footer).toContain('https://discord.gg/zEeHqdPQWQ')
		expect(footer).toContain("rel: 'noopener noreferrer'")
	})

	test('keeps footer copy in English i18n', () => {
		expect(en.footer).toMatchObject({
			copyrightZeepCentraal: '© 2023 ZeepCentraal — Akane.',
			copyrightZeepkist: 'Zeepkist © Yannic Geurts.',
			disclaimer:
				'ZeepCentraal is not affiliated with Zeepkist, Yannic Geurts, or Steelpan Interactive.',
		})
		expect(en.pages).toHaveProperty('terms')
		expect(en.pages).toHaveProperty('privacy')
	})

	test('registers and supplies complete dated legal documents', () => {
		expect(contentConfig).toContain("source: 'legal/**/*.md'")
		expect(terms).toContain('Effective Date: 18/08/2025')
		expect(terms).toContain('## 12. Contact')
		expect(privacy).toContain('Effective Date: 18/08/2025')
		expect(privacy).toContain('## Your Rights')
		expect(privacy).toContain('[privacy@zeepki.st](mailto:privacy@zeepki.st)')
	})
})
