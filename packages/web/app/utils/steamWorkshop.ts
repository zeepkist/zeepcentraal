const WORKSHOP_ITEM_URL = 'https://steamcommunity.com/sharedfiles/filedetails/'

export function steamWorkshopItemUrl(workshopId: unknown): string | undefined {
	const value = String(workshopId ?? '').trim()
	if (!/^\d+$/.test(value)) return undefined
	return `${WORKSHOP_ITEM_URL}?id=${encodeURIComponent(value)}`
}
