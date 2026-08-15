import { icons as tablerIconSet } from '@iconify-json/tabler'
import { describe, expect, it } from 'vitest'
import { bundledUiIcons, uiIconClientBundle, uiIcons } from '../../config/uiIcons'

const nuxtUiIconKeys = [
	'arrowDown',
	'arrowLeft',
	'arrowRight',
	'arrowUp',
	'caution',
	'check',
	'chevronDoubleLeft',
	'chevronDoubleRight',
	'chevronDown',
	'chevronLeft',
	'chevronRight',
	'chevronUp',
	'close',
	'copy',
	'copyCheck',
	'dark',
	'drag',
	'ellipsis',
	'error',
	'external',
	'eye',
	'eyeOff',
	'file',
	'folder',
	'folderOpen',
	'hash',
	'info',
	'light',
	'loading',
	'menu',
	'minus',
	'panelClose',
	'panelOpen',
	'plus',
	'reload',
	'search',
	'stop',
	'star',
	'success',
	'system',
	'tip',
	'upload',
	'warning',
] as const

describe('Nuxt UI icons', () => {
	it('overrides every semantic default with an installed Tabler icon', () => {
		expect(Object.keys(uiIcons).sort()).toEqual([...nuxtUiIconKeys].sort())

		for (const icon of Object.values(uiIcons)) {
			expect(icon).toMatch(/^i-tabler-/)
			expect(tablerIconSet.icons).toHaveProperty(icon.slice('i-tabler-'.length))
		}
	})

	it('pre-bundles semantic defaults and scans app icon literals for SSR', () => {
		expect(uiIconClientBundle).toEqual({
			icons: bundledUiIcons,
			scan: true,
		})
		expect(uiIconClientBundle.icons).toEqual(
			Object.values(uiIcons).map((icon) => icon.replace(/^i-tabler-/, 'tabler:')),
		)
	})
})
