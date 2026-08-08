export const RECORDS_OG_PAGE_PATH = '/records'
export const RECORDS_OG_STATE_KEY = 'records-og-image-path'
export const RECORDS_OG_COMPONENT_REVISION = 'records-card-v1'
export const RECORDS_OG_OPTIONS = {
	component: 'RecordsTakumi',
	props: { slug: 'records' },
	cacheKey: 'records-card',
} as const

export function useRecordsOgImage() {
	const path = useState<string>(RECORDS_OG_STATE_KEY)
	useSeoMeta({
		ogImage: path.value,
		ogImageWidth: 1200,
		ogImageHeight: 630,
		twitterCard: 'summary_large_image',
		twitterImage: path.value,
	})
	return path
}
