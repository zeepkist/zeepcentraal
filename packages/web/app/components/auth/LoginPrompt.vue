<script setup vapor lang="ts">
defineProps<{
	title: string
	description?: string
	steamLabel?: string
	discordLabel?: string
	orLabel?: string
	compact?: boolean
}>()

const emit = defineEmits<{
	login: [provider: 'steam' | 'discord']
}>()
</script>

<template>
	<section
		:class="
			compact
				? 'rounded-xl border border-border/60 bg-background/35 p-3 text-sm backdrop-blur-sm'
				: 'rounded-2xl border border-primary/25 bg-linear-to-br from-primary/15 via-card to-card p-6 shadow-sm sm:p-8'
		"
	>
		<div class="flex items-start gap-4">
			<span
				v-if="!compact"
				class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"
			>
				<TablerIcon name="login" class="size-6" />
			</span>
			<div>
				<h2 :class="compact ? 'font-semibold' : 'text-xl font-bold text-highlighted'">{{ title }}</h2>
				<p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
			</div>
		</div>
		<div class="mt-4 flex flex-wrap items-start gap-3">
			<UButton
				color="primary"
				:variant="compact ? 'outline' : 'solid'"
				:size="compact ? 'sm' : 'lg'"
				@click="emit('login', 'steam')"
			>
				<TablerIcon name="brand-steam" class="size-4" />
				{{ steamLabel ?? $t('auth.steam') }}
			</UButton>
			<span class="mt-2 text-sm text-muted-foreground">{{ orLabel ?? $t('auth.loginPrompt.or') }}</span>
			<div class="max-w-sm space-y-2">
				<UButton
					color="primary"
					variant="outline"
					:size="compact ? 'sm' : 'lg'"
					@click="emit('login', 'discord')"
				>
					<TablerIcon name="brand-discord" class="size-4" />
					{{ discordLabel ?? $t('auth.discord') }}
				</UButton>
				<p class="text-xs leading-relaxed text-muted-foreground">
					{{ $t('auth.loginPrompt.discordRequirement') }}
				</p>
			</div>
		</div>
	</section>
</template>
