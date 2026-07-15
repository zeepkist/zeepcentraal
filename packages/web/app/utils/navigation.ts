import type { NavItem, PlaceholderPage } from '~/types/app'

export const mainNav: NavItem[] = [
	{
		to: '/',
		labelKey: 'nav.home',
		icon: 'dashboard',
	},
	{
		to: '/records',
		labelKey: 'nav.records',
		icon: 'trophy',
	},
	{
		to: '/levels',
		labelKey: 'nav.levels',
		icon: 'map',
	},
	{
		to: '/users',
		labelKey: 'nav.users',
		icon: 'users',
	},
	{
		to: '/super-league',
		labelKey: 'nav.zsl',
		icon: 'flag',
	},
	{
		to: '/mods',
		labelKey: 'nav.mods',
		icon: 'plug',
	},
	{
		to: '/adventure/a',
		labelKey: 'nav.adventure',
		icon: 'route',
	},
	{
		to: '/cosmetics',
		labelKey: 'nav.cosmetics',
		icon: 'palette',
	},
	{
		to: '/totw',
		labelKey: 'nav.totw',
		icon: 'calendar-event',
	},
	{
		to: '/totm',
		labelKey: 'nav.totm',
		icon: 'calendar-stats',
	},
	{
		to: '/wiki',
		labelKey: 'nav.wiki',
		icon: 'book',
	},
	{
		to: '/developer',
		labelKey: 'nav.developer',
		icon: 'code',
	},
]

export const secondaryPages: PlaceholderPage[] = [
	{ to: '/cosmetics', key: 'cosmetics', icon: 'palette' },
	{ to: '/totw', key: 'totw', icon: 'calendar-event' },
	{ to: '/totm', key: 'totm', icon: 'calendar-stats' },
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
