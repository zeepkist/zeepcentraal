export function usePageSeo(pageKey: string) {
	const { t } = useI18n()
	const title = computed(() => t(`pages.${pageKey}.seo.title`))
	const description = computed(() => t(`pages.${pageKey}.seo.description`))

	useSeoMeta({
		title,
		ogTitle: title,
		description,
		ogDescription: description,
		twitterCard: 'summary_large_image',
	})
	useSchemaOrg([defineWebPage({ name: title, description })])
	defineOgImage('NuxtSeo.satori', { title, description, theme: '#facc15', colorMode: 'dark' })
}
