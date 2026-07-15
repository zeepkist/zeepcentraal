<template>
	<UFooter :ui="{ root: 'border-t border-border bg-card/35', top: 'py-10 lg:py-12' }">
		<template #top>
			<UContainer>
				<UFooterColumns :columns="footerColumns">
					<template #left>
						<div class="max-w-sm">
							<AppLogo large />
							<p class="mt-4 text-sm leading-6 text-muted-foreground">
								{{ $t('footer.description') }}
							</p>
						</div>
					</template>

					<template #link-leading="{ link }">
						<TablerIcon v-if="link.tablerIcon" :name="link.tablerIcon" class="size-4" />
					</template>
				</UFooterColumns>
			</UContainer>
		</template>

		<template #left>
			<div class="text-center text-xs leading-5 text-muted-foreground lg:text-left">
				<p>{{ $t('footer.copyrightZeepCentraal') }}</p>
				<p>{{ $t('footer.copyrightZeepkist') }}</p>
			</div>
		</template>

		<template #right>
			<p class="max-w-2xl text-center text-xs leading-5 text-muted-foreground lg:text-right">
				{{ $t('footer.disclaimer') }}
			</p>
		</template>
	</UFooter>
</template>

<script setup lang="ts">
import type { TablerIconName } from '~/utils/icons'
import { isNavigationTargetActive } from '~/utils/navigation'

type FooterLink = {
	label: string
	to: string
	tablerIcon: TablerIconName
	active?: boolean
	target?: '_blank'
	rel?: string
}

const { t } = useI18n()
const route = useRoute()
const external = (label: string, to: string, tablerIcon: TablerIconName): FooterLink => ({
	label,
	to,
	tablerIcon,
	target: '_blank',
	rel: 'noopener noreferrer',
})
const internal = (label: string, to: string, tablerIcon: TablerIconName): FooterLink => ({
	label,
	to,
	tablerIcon,
	active: isNavigationTargetActive(route.path, to),
})
const footerColumns = computed(() => [
	{
		label: t('footer.columns.explore'),
		children: [
			internal(t('nav.records'), '/records', 'trophy'),
			internal(t('nav.levels'), '/levels', 'map'),
			internal(t('nav.users'), '/users', 'users'),
			internal(t('nav.zsl'), '/super-league', 'flag'),
			internal(t('nav.mods'), '/mods', 'plug'),
		],
	},
	{
		label: t('footer.columns.discover'),
		children: [
			internal(t('nav.adventure'), '/adventure/a', 'route'),
			internal(t('nav.cosmetics'), '/cosmetics', 'palette'),
			internal(t('nav.totw'), '/totw', 'calendar-event'),
			internal(t('nav.totm'), '/totm', 'calendar-stats'),
			internal(t('nav.wiki'), '/wiki', 'book'),
		],
	},
	{
		label: t('footer.columns.community'),
		children: [
			external(
				t('external.officialDiscord.short'),
				'https://discord.gg/WjRuWGRnGp',
				'brand-discord',
			),
			external(
				t('external.moddingDiscord.short'),
				'https://discord.gg/zEeHqdPQWQ',
				'brand-discord',
			),
			external(
				t('footer.links.github'),
				'https://github.com/zeepkist/zeepcentraal',
				'brand-github',
			),
			internal(t('nav.developer'), '/developer', 'code'),
		],
	},
	{
		label: t('footer.columns.legal'),
		children: [
			internal(t('footer.links.terms'), '/terms', 'shield-check'),
			internal(t('footer.links.privacy'), '/privacy', 'shield-check'),
		],
	},
])
</script>
