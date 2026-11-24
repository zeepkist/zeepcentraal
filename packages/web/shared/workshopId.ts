export function isWorkshopId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[1-9][0-9]{0,18}$/.test(value) &&
		BigInt(value) <= 9223372036854775807n
	)
}

export function workshopIdFromSteamUrl(input: string): string | null {
	try {
		const url = new URL(input.trim())
		if (
			url.origin !== 'https://steamcommunity.com' ||
			url.username ||
			url.password ||
			!/^\/(?:sharedfiles|workshop)\/filedetails\/?$/.test(url.pathname)
		) {
			return null
		}
		const [id, duplicate] = url.searchParams.getAll('id')
		return duplicate === undefined && isWorkshopId(id) ? id : null
	} catch {
		return null
	}
}
