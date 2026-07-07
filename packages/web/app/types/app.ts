export type NavItem = {
	to: string
	labelKey: string
	descriptionKey?: string
	icon?: string
	children?: NavItem[]
}

export type PlaceholderPage = {
	key: string
	icon: string
	to: string
}

export type SessionUser = {
	id: number
	steamId: string
	steamName?: string
	discordId?: string | null
}
