export interface ContentBreadcrumb {
	label: string
	to: string
}

export function formatBreadcrumbSegment(segment: string): string {
	return segment
		.split(/[-_]+/)
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ')
}

export function buildAncestorBreadcrumbs(
	basePath: string,
	rootLabel: string,
	segments: string[],
): ContentBreadcrumb[] {
	const normalizedBase = `/${basePath.split('/').filter(Boolean).join('/')}`
	const breadcrumbs: ContentBreadcrumb[] = [{ label: rootLabel, to: normalizedBase }]
	const ancestors = segments.filter(Boolean).slice(0, -1)
	const path = [normalizedBase]

	for (const segment of ancestors) {
		path.push(segment)
		breadcrumbs.push({
			label: formatBreadcrumbSegment(segment),
			to: path.join('/'),
		})
	}

	return breadcrumbs
}
