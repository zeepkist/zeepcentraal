import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, getCurrentInstance, ref } from 'vue'
import { useAppI18n } from '../../app/composables/useAppI18n'

afterEach(() => vi.unstubAllGlobals())

describe('global app translations', () => {
	it('works without a VDOM instance and preserves the reactive locale', () => {
		const locale = ref('en')
		const composer = { locale, t: () => (locale.value === 'en' ? 'Hello' : 'Hallo') }
		vi.stubGlobal('useNuxtApp', () => ({ $i18n: composer }))
		expect(getCurrentInstance()).toBeNull()
		const i18n = useAppI18n()
		const label = computed(() => i18n.t('greeting'))
		expect(label.value).toBe('Hello')
		locale.value = 'nl'
		expect(label.value).toBe('Hallo')
	})
})
