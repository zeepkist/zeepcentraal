<template>
	<UCard
		class="relative overflow-hidden rounded-3xl border-primary/25 bg-linear-to-br from-primary/20 via-card to-card"
	>
		<div class="hero-orbit absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
		<div class="absolute -bottom-32 left-1/3 size-64 rounded-full bg-secondary/10 blur-3xl" />
		<div
			v-if="pending"
			class="relative grid min-h-80 animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] lg:items-center"
			aria-busy="true"
		>
			<div class="space-y-4">
				<USkeleton class="h-12 w-3/4" />
				<USkeleton class="h-6 w-full max-w-2xl" />
				<div class="grid grid-cols-3 gap-3 pt-4">
					<USkeleton v-for="index in 3" :key="index" class="h-20" />
				</div>
			</div>
			<div class="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-5">
				<USkeleton class="h-8 w-2/3" />
				<USkeleton class="h-16 w-full" />
				<USkeleton class="h-14 w-full" />
			</div>
		</div>
		<div
			v-else
			class="hero-enter relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] lg:items-stretch"
		>
			<div class="relative flex min-w-0 flex-col justify-center">
				<h1 class="max-w-3xl text-3xl font-black tracking-tight text-balance md:text-5xl">
					{{ title }}
				</h1>
				<p class="mt-4 max-w-2xl text-lg text-muted-foreground">{{ description }}</p>
				<div v-if="metrics?.length" class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
					<div
						v-for="(metric, index) in metrics"
						:key="metric.label"
						class="hero-metric rounded-xl border border-border/60 bg-background/45 p-3 backdrop-blur-sm"
						:class="{ 'opacity-65': metric.muted }"
						:style="{ '--metric-delay': `${index * 55}ms` }"
					>
						<div
							class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>
							<TablerIcon :name="metric.icon" class="size-4 text-primary" />
							{{ metric.label }}
						</div>
						<p class="mt-2 text-xl font-black tabular-nums">{{ metric.value }}</p>
					</div>
				</div>
				<div v-if="loginPrompt" class="mt-7 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0">
					<div
						class="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/35 p-3 text-sm backdrop-blur-sm"
					>
						<span class="font-semibold">{{ loginPrompt.label }}</span>
						<UButton
							color="primary"
							variant="outline"
							size="sm"
							@click="$emit('login', 'steam')"
						>
							<TablerIcon name="brand-steam" class="size-4" />
							{{ loginPrompt.steamLabel }}
						</UButton>
						<span class="text-muted-foreground">{{ loginPrompt.orLabel }}</span>
						<UButton
							color="primary"
							variant="outline"
							size="sm"
							@click="$emit('login', 'discord')"
						>
							<TablerIcon name="brand-discord" class="size-4" />
							{{ loginPrompt.discordLabel }}
						</UButton>
					</div>
				</div>
			</div>
			<div
				v-if="panel"
				class="rounded-2xl border border-primary/20 bg-background/50 p-5 shadow-xl shadow-black/5 backdrop-blur-md"
			>
				<div class="flex items-start gap-3">
					<span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
						<TablerIcon :name="panel.icon" class="size-6" />
					</span>
					<div>
						<h2 class="text-xl font-black">{{ panel.title }}</h2>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ panel.description }}</p>
					</div>
				</div>
				<ul v-if="panel.features?.length" class="mt-4 grid gap-2 text-sm">
					<li v-for="feature in panel.features" :key="feature" class="flex gap-2">
						<TablerIcon name="circle-check" class="mt-0.5 size-4 shrink-0 text-primary" />
						<span>{{ feature }}</span>
					</li>
				</ul>
				<div class="mt-5 grid gap-2">
					<DashboardHeroAction v-for="action in actions" :key="action.href" :action="action" />
				</div>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { HeroAction, HeroMetric, HeroPanel } from '~/types/app'

defineProps<{
	title: string
	description: string
	actions: HeroAction[]
	metrics?: HeroMetric[]
	panel?: HeroPanel
	pending?: boolean
	loginPrompt?: {
		label: string
		steamLabel: string
		discordLabel: string
		orLabel: string
	}
}>()

defineEmits<{
	login: [provider: 'steam' | 'discord']
}>()
</script>
