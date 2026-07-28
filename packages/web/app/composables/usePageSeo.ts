export function usePageSeo(pageKey: string) {
	const { t } = useI18n()
	const title = computed(() => t(`pages.${pageKey}.seo.title`))
	const description = computed(() => t(`pages.${pageKey}.seo.description`))

	useHead({
		link: [
			{
				rel: 'icon',
				type: 'image/png',
				href: '/android-chrome-192x192.png',
			},
		],
	})
	useSeoMeta({
		title,
		ogTitle: title,
		twitterTitle: title,
		description,
		ogDescription: description,
		twitterDescription: description,
		twitterCard: 'summary_large_image',
	})
	useSchemaOrg([defineWebPage({ name: title, description })])
}
