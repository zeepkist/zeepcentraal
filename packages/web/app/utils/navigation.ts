import type { NavItem, PlaceholderPage } from '~/types/app'

export const navigationRouteFamilies: Readonly<Record<string, readonly string[]>> = {
	'/': ['/'],
	'/records': ['/records', '/record'],
	'/levels': ['/levels', '/level'],
	'/users': ['/users', '/user'],
	'/super-league': ['/super-league'],
	'/mods': ['/mods', '/mod'],
	'/adventure/a': ['/adventure'],
	'/cosmetics': ['/cosmetics', '/cosmetic'],
	'/totw': ['/totw'],
	'/totm': ['/totm'],
	'/wiki': ['/wiki'],
	'/developer': ['/developer'],
}

function normalizeNavigationPath(path: string): string {
	const pathname = path.split(/[?#]/, 1)[0] || '/'
	if (pathname === '/') return pathname

	return pathname.replace(/\/+$/, '') || '/'
}

function matchesRouteRoot(path: string, root: string): boolean {
	if (root === '/') return path === '/'

	return path === root || path.startsWith(`${root}/`)
}

export function isNavigationTargetActive(currentPath: string, target: string): boolean {
	const path = normalizeNavigationPath(currentPath)
	const normalizedTarget = normalizeNavigationPath(target)
	const family = navigationRouteFamilies[normalizedTarget] ?? [normalizedTarget]

	return family.some((root) => matchesRouteRoot(path, normalizeNavigationPath(root)))
}

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
		to: '/adventure/a',
		labelKey: 'nav.adventure',
		icon: 'route',
	},
	{
		to: '/mods',
		labelKey: 'nav.mods',
		icon: 'plug',
	},
	{
		to: '/cosmetics',
		labelKey: 'nav.cosmetics',
		icon: 'palette',
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
		href: 'https://discord.gg/WjRuWGRnGp',
		icon: 'brand-discord',
	},
	{
		key: 'moddingDiscord',
		href: 'https://discord.gg/zEeHqdPQWQ',
		icon: 'brand-discord',
	},
]
