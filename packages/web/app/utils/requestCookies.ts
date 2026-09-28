/** Merge newly issued SSR cookies without dropping unchanged cookies. Never serialize this into payload state. */
export function mergeRequestCookies(original: string | undefined, issued: string[]): string {
	const cookies = new Map<string, string>()
	for (const entry of [
		...(original ?? '').split(';'),
		...issued.map((value) => value.split(';', 1)[0] ?? ''),
	]) {
		const trimmed = entry.trim()
		const separator = trimmed.indexOf('=')
		if (separator > 0) cookies.set(trimmed.slice(0, separator), trimmed)
	}
	return [...cookies.values()].join('; ')
}
