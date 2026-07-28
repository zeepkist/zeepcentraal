import { formatBreadcrumbSegment } from '~/utils/contentBreadcrumbs'

export interface OgContentData {
	breadcrumbs: string[]
	description?: string
	title: string
}

function getSlugSegments(slug: string): string[] {
	return slug
		.trim()
		.split('/')
		.map((segment) => segment.trim())
		.filter(Boolean)
}

function getWikiSegments(slug: string): string[] {
	const segments = getSlugSegments(slug)
	return segments[0]?.toLowerCase() === 'wiki' ? segments.slice(1) : segments
}

function getWikiFallbackTitle(segments: string[]): string {
	const segment = segments.at(-1)
	return segment ? formatBreadcrumbSegment(segment) : 'Wiki'
}

export async function useOgWikiContentData(slug: string): Promise<OgContentData> {
	const segments = getWikiSegments(slug)
	const path = segments.length > 0 ? `/wiki/${segments.join('/')}` : '/wiki'
	const { data: document } = await useAsyncData(`og-content:${path}`, () =>
		queryCollection('wiki').path(path).first(),
	)
	const title = document.value?.title ?? getWikiFallbackTitle(segments)
	const breadcrumbs =
		segments.length === 0
			? [title]
			: ['Wiki', ...segments.slice(0, -1).map(formatBreadcrumbSegment), title]

	return {
		breadcrumbs,
		description: document.value?.description,
		title,
	}
}

export async function useOgLegalContentData(
	slug: string,
	fallbackSlug: 'privacy' | 'terms',
): Promise<OgContentData> {
	const requestedSlug = getSlugSegments(slug).at(-1)?.toLowerCase()
	const legalSlug = requestedSlug === fallbackSlug ? requestedSlug : fallbackSlug
	const path = `/legal/${legalSlug}`
	const { data: document } = await useAsyncData(`og-content:${path}`, () =>
		queryCollection('legal').path(path).first(),
	)
	const title = document.value?.title ?? formatBreadcrumbSegment(legalSlug)

	return {
		breadcrumbs: ['Legal', title],
		description: document.value?.description,
		title,
	}
}
