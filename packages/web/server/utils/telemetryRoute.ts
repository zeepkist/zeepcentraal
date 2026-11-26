export function resolveTelemetryRoute(matchedRoute: unknown): string {
	const routePath =
		typeof matchedRoute === 'object' && matchedRoute !== null && 'path' in matchedRoute
			? matchedRoute.path
			: undefined

	return typeof routePath === 'string' && routePath.length > 0 ? routePath : 'unmatched'
}
