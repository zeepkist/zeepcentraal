import type { Composer } from 'vue-i18n'

/** App translations share Nuxt's global composer; Vue I18n's useI18n requires a VDOM instance. */
export function useAppI18n(): Composer {
	return useNuxtApp().$i18n as unknown as Composer
}
