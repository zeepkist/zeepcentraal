import {
	IconBook,
	IconBrandDiscord,
	IconBrandSteam,
	IconCalendarEvent,
	IconCode,
	IconDashboard,
	IconFlag,
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarLeftExpand,
	IconMap,
	IconPalette,
	IconPlug,
	IconRoute,
	IconTrophy,
	IconUsers,
} from '@tabler/icons-vue'

export const tablerIcons = {
	book: IconBook,
	'brand-discord': IconBrandDiscord,
	'brand-steam': IconBrandSteam,
	calendar: IconCalendarEvent,
	code: IconCode,
	dashboard: IconDashboard,
	flag: IconFlag,
	map: IconMap,
	palette: IconPalette,
	plug: IconPlug,
	route: IconRoute,
	'sidebar-collapse': IconLayoutSidebarLeftCollapse,
	'sidebar-expand': IconLayoutSidebarLeftExpand,
	trophy: IconTrophy,
	users: IconUsers,
}

export type TablerIconName = keyof typeof tablerIcons
