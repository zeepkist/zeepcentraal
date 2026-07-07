export function usePageSeo(pageKey: string) {
	const { t } = useI18n()

	useSeoMeta({
		title: () => t(`pages.${pageKey}.seo.title`),
		ogTitle: () => t(`pages.${pageKey}.seo.title`),
		description: () => t(`pages.${pageKey}.seo.description`),
		ogDescription: () => t(`pages.${pageKey}.seo.description`),
		twitterCard: 'summary_large_image',
	})
}
