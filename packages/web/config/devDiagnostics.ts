// Nuxt virtual components must stay outside Vite's standalone dependency optimizer.
export function nuxtComponentsOptimizerPlugin() {
	return {
		name: 'zeepcentraal-nuxt-components-optimizer',
		resolveId(source: string) {
			return source === '#components' ? { id: source, external: true as const } : null
		},
	}
}

export function isMissingDependencySourceWarning(message: string): boolean {
	const normalized = message.replaceAll('\\', '/')
	return /^Sourcemap for "[^"\n]*\/node_modules\/(?:@urql\/vue\/dist\/urql-vue|@urql\/core\/dist\/urql-core(?:-chunk)?|@0no-co\/graphql\.web\/dist\/graphql\.web)\.mjs" points to missing source files$/.test(
		normalized,
	)
}

export function filterDependencySourceWarnings<T extends unknown[]>(
	warn: (message: string, ...options: T) => void,
) {
	return (message: string, ...options: T) => {
		if (!isMissingDependencySourceWarning(message)) warn(message, ...options)
	}
}

export function isUnusedNitroCookieWarning(warning: {
	code?: string
	exporter?: string
	names?: string[]
	ids?: string[]
}): boolean {
	return (
		warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
		/\/node_modules\/h3\/dist\/index\.mjs$/.test(
			warning.exporter?.replaceAll('\\', '/') ?? '',
		) &&
		warning.names?.length === 1 &&
		warning.names[0] === 'parseCookies' &&
		warning.ids?.length === 1 &&
		/\/node_modules\/@nuxt\/nitro-server\/dist\/runtime\/server\.mjs$/.test(
			warning.ids[0]?.replaceAll('\\', '/') ?? '',
		)
	)
}
