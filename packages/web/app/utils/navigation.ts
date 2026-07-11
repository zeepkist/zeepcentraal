import type { NavItem, PlaceholderPage } from '~/types/app'

export const mainNav: NavItem[] = [
	{
		to: '/',
		labelKey: 'nav.home',
		descriptionKey: 'navDescriptions.home',
		icon: 'dashboard',
	},
	{
		to: '/records',
		labelKey: 'nav.records',
		descriptionKey: 'navDescriptions.records',
		icon: 'trophy',
	},
	{
		to: '/levels',
		labelKey: 'nav.levels',
		descriptionKey: 'navDescriptions.levels',
		icon: 'map',
	},
	{
		to: '/users',
		labelKey: 'nav.users',
		descriptionKey: 'navDescriptions.users',
		icon: 'users',
	},
	{
		to: '/zsl',
		labelKey: 'nav.zsl',
		descriptionKey: 'navDescriptions.zsl',
		icon: 'flag',
	},
	{
		to: '/mods',
		labelKey: 'nav.mods',
		descriptionKey: 'navDescriptions.mods',
		icon: 'plug',
	},
	{
		to: '/adventure',
		labelKey: 'nav.adventure',
		descriptionKey: 'navDescriptions.adventure',
		icon: 'route',
	},
	{
		to: '/wiki',
		labelKey: 'nav.wiki',
		descriptionKey: 'navDescriptions.wiki',
		icon: 'book',
	},
	{
		to: '/developer',
		labelKey: 'nav.developer',
		descriptionKey: 'navDescriptions.developer',
		icon: 'code',
	},
]

export const secondaryPages: PlaceholderPage[] = [
	{ to: '/totd', key: 'totd', icon: 'calendar' },
	{ to: '/cosmetics', key: 'cosmetics', icon: 'palette' },
	{ to: '/wiki/guides', key: 'guides', icon: 'book' },
	{ to: '/developer/graphql', key: 'graphql', icon: 'code' },
]

export const externalLinks = [
	{
		key: 'steam',
		href: 'https://store.steampowered.com/app/1440670/Zeepkist/',
		icon: 'brand-steam',
	},
	{
		key: 'officialDiscord',
		href: 'https://discord.gg/zeepkist',
		icon: 'brand-discord',
	},
	{
		key: 'moddingDiscord',
		href: 'https://discord.gg/zeepkist-modding',
		icon: 'brand-discord',
	},
]
