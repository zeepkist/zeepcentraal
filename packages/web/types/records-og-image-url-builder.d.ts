declare module '#records-og-image-url-builder' {
	type RecordsOgImageUrlOptions = {
		component: string
		props: Record<string, string>
		cacheKey: string
		_path: string
		_componentHash: string
	}

	export function buildOgImageUrl(
		options: RecordsOgImageUrlOptions,
		extension: string,
		isStatic: boolean,
		defaults: Record<string, unknown>,
		secret?: string,
	): { url: string; hash?: string }
}
