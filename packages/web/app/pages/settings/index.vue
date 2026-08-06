<script setup vapor lang="ts">
usePageSeo('settings')
defineOgImage('Settings.takumi', { slug: 'settings' })
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:eyebrow="$t('pages.settings.eyebrow')"
			:title="$t('settings.account.title')"
			:description="$t('settings.account.description')"
		/>
		<UCard class="rounded-2xl border-border/80 bg-card/90">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-start gap-3">
					<div class="flex size-10 items-center justify-center rounded-xl bg-[#5865F2]/12 text-[#5865F2]">
						<TablerIcon name="brand-discord" class="size-6" />
					</div>
					<div>
						<h2 class="font-semibold text-highlighted">
							{{ $t('settings.discord.overview.title') }}
						</h2>
						<p class="mt-1 text-sm text-muted">
							{{ $t('settings.discord.overview.description') }}
						</p>
					</div>
				</div>
				<UButton
					:label="$t('settings.discord.overview.action')"
					icon="i-tabler-arrow-right"
					trailing
					to="/settings/discord"
				/>
			</div>
		</UCard>
	</UContainer>
</template>
