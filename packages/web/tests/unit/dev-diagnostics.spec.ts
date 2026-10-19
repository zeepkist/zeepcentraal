import { fileURLToPath } from 'node:url'
import { describe, expect, test, vi } from 'vitest'
import {
	filterDependencySourceWarnings,
	isMissingDependencySourceWarning,
	isUnusedNitroCookieWarning,
	nuxtComponentsOptimizerPlugin,
} from '../../config/devDiagnostics'

describe('Nuxt dependency optimizer', () => {
	test('externalizes only the virtual component import', () => {
		const plugin = nuxtComponentsOptimizerPlugin()
		expect(plugin.resolveId('#components')).toEqual({ id: '#components', external: true })
		for (const source of ['#imports', '#components/other', '@nuxtjs/i18n', './component.vue']) {
			expect(plugin.resolveId(source)).toBeNull()
		}
	})
})

test('OG compiler resolves solid borders and custom neutral colors', async () => {
	const { createTw4Provider } = await import(
		new URL('../../node_modules/nuxt-og-image/dist/chunks/tw4.mjs', import.meta.url).href
	)
	const provider = createTw4Provider({
		resolveCssPath: async () =>
			fileURLToPath(new URL('../../app/assets/css/tailwind.css', import.meta.url)),
		loadNuxtUiColors: async () => ({ neutral: 'warm-neutral' }),
	})
	const shades = {
		50: '#fafaf9',
		100: '#f5f5f4',
		200: '#e7e5e4',
		300: '#d6d3d1',
		400: '#a8a29e',
		500: '#78716c',
		600: '#57534e',
		700: '#44403c',
		800: '#292524',
		900: '#171513',
		950: '#0c0a09',
	}
	const colorClass = (shade: string) => `bg-[var(--ui-color-neutral-${shade})]`
	const styles = await provider.resolveClassesToStyles(
		['border', ...Object.keys(shades).map(colorClass)],
		'dev-diagnostics-test',
	)
	expect(styles.border).toEqual({ 'border-style': 'solid', 'border-width': '1px' })
	for (const [shade, color] of Object.entries(shades)) {
		expect(styles[colorClass(shade)]).toEqual({ 'background-color': color })
	}
})

describe('dependency diagnostics', () => {
	const distributions = [
		'@urql/vue/dist/urql-vue.mjs',
		'@urql/core/dist/urql-core.mjs',
		'@urql/core/dist/urql-core-chunk.mjs',
		'@0no-co/graphql.web/dist/graphql.web.mjs',
	]
	const sourceWarning = (path: string) => `Sourcemap for "${path}" points to missing source files`

	test.each(distributions)('recognizes missing published sources: %s', (distribution) => {
		const path = `/repo/node_modules/.bun/package/node_modules/${distribution}`
		expect(isMissingDependencySourceWarning(sourceWarning(path))).toBe(true)
		expect(
			isMissingDependencySourceWarning(sourceWarning(`X:${path.replaceAll('/', '\\')}`)),
		).toBe(true)
	})

	test('forwards unrelated warnings and logger options unchanged', () => {
		const warn = vi.fn()
		const filtered = filterDependencySourceWarnings(warn)
		filtered(sourceWarning(`/repo/node_modules/${distributions[0]}`))
		expect(warn).not.toHaveBeenCalled()
		for (const message of [
			sourceWarning('/repo/app/component.vue'),
			sourceWarning('/repo/node_modules/other/dist/index.mjs'),
			sourceWarning('/repo/node_modules/@urql/core/dist/new-file.mjs'),
			'Sourcemap is invalid',
			'Application warning',
		]) {
			const options = { timestamp: true }
			filtered(message, options)
			expect(warn).toHaveBeenLastCalledWith(message, options)
		}
	})

	const cookieWarning = {
		code: 'UNUSED_EXTERNAL_IMPORT',
		exporter: 'file:///repo/node_modules/h3/dist/index.mjs',
		names: ['parseCookies'],
		ids: ['/repo/node_modules/@nuxt/nitro-server/dist/runtime/server.mjs'],
	}

	test('recognizes only Nitro cookie import on Windows and POSIX', () => {
		expect(isUnusedNitroCookieWarning(cookieWarning)).toBe(true)
		expect(
			isUnusedNitroCookieWarning({
				...cookieWarning,
				ids: cookieWarning.ids.map((path) => `X:${path.replaceAll('/', '\\')}`),
			}),
		).toBe(true)
	})

	test('preserves other imports, importers and diagnostic codes', () => {
		for (const warning of [
			{},
			{ ...cookieWarning, code: 'OTHER_WARNING' },
			{ ...cookieWarning, exporter: 'another-package' },
			{ ...cookieWarning, names: ['getCookie'] },
			{ ...cookieWarning, names: ['parseCookies', 'getCookie'] },
			{ ...cookieWarning, ids: ['/repo/server/api/cookies.ts'] },
			{ ...cookieWarning, ids: [...cookieWarning.ids, '/repo/server/api/cookies.ts'] },
		]) {
			expect(isUnusedNitroCookieWarning(warning)).toBe(false)
		}
	})
})
