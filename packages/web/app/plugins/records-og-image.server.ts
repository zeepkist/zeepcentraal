import { useOgImageRuntimeConfig } from '#og-image/app/utils'
import { buildOgImageUrl } from '#records-og-image-url-builder'

export default defineNuxtPlugin(() => {
	const { app, defaults, security } = useOgImageRuntimeConfig()
	const secret = security.secret || undefined
	const isStatic = import.meta.prerender && !(secret && security.strict)
	const { url } = buildOgImageUrl(
		{
			...RECORDS_OG_OPTIONS,
			_path: RECORDS_OG_PAGE_PATH,
			_componentHash: RECORDS_OG_COMPONENT_REVISION,
		},
		defaults.extension ?? 'png',
		isStatic,
		defaults,
		secret,
	)
	const path = `${app.baseURL.replace(/\/+$/, '')}${url}`
	useState(RECORDS_OG_STATE_KEY, () => path)
})
