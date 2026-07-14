<template>
	<section class="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-lg shadow-primary/5 sm:p-7 lg:p-9">
		<div class="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
			<div class="min-w-0">
				<p class="text-sm font-bold uppercase tracking-[0.18em] text-primary">{{ labels.eyebrow }}</p>
				<h1 class="mt-3 truncate text-4xl font-black tracking-tight text-highlighted md:text-6xl">{{ user.steamName ?? user.steamId }}</h1>
				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
					<span class="inline-flex items-center gap-2"><TablerIcon name="calendar" class="size-4" />{{ labels.joined }} <NuxtTime :datetime="user.dateCreated" relative /></span>
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<UButton v-if="profileUrl" :to="profileUrl" target="_blank" rel="noopener" color="primary" icon="i-tabler-brand-steam" trailing-icon="i-tabler-external-link">{{ labels.steamProfile }}</UButton>
					<UButton v-if="workshopUrl" :to="workshopUrl" target="_blank" rel="noopener" color="neutral" variant="soft" icon="i-tabler-tools" trailing-icon="i-tabler-external-link">{{ labels.steamWorkshop }}</UButton>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="col-span-2 rounded-2xl border border-primary/25 bg-primary/10 p-5">
					<p class="text-xs font-bold uppercase tracking-wider text-primary">{{ labels.globalRank }}</p>
					<p class="mt-2 text-5xl font-black tabular-nums text-highlighted">{{ rank }}</p>
				</div>
				<div class="rounded-xl border border-border/70 bg-default/65 p-4">
					<p class="text-xs text-muted-foreground">{{ labels.rankedPoints }}</p>
					<p class="mt-1 text-2xl font-black tabular-nums text-highlighted">{{ format(user.rankedPoints) }}</p>
				</div>
				<div class="rounded-xl border border-border/70 bg-default/65 p-4">
					<p class="text-xs text-muted-foreground">{{ labels.totalPoints }}</p>
					<p class="mt-1 text-2xl font-black tabular-nums text-highlighted">{{ format(user.totalPoints) }}</p>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { UserProfileSummary } from '~/types/app'

const props = defineProps<{
	user: UserProfileSummary
	profileUrl?: string
	workshopUrl?: string
	labels: { eyebrow: string; joined: string; globalRank: string; rankedPoints: string; totalPoints: string; unranked: string; steamProfile: string; steamWorkshop: string }
}>()
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const rank = computed(() => props.user.rank && props.user.rank > 0 ? `#${number.value.format(props.user.rank)}` : props.labels.unranked)
const format = (value: number) => number.value.format(value)
</script>
