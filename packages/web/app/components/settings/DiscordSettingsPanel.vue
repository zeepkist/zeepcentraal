<script setup vapor lang="ts">
const {
	discordId,
	generateCode,
	linkCode,
	linked,
	oauthLinkUrl,
	pendingCode,
	pendingUnlink,
	session,
	unlink,
} = useDiscordSettings()
const { login } = useAccountActions()
</script>

<template>
	<div class="space-y-4">
		<UAlert
			v-if="!session.user"
			color="warning"
			:title="$t('settings.discord.signIn.title')"
			:description="$t('settings.discord.signIn.description')"
		>
			<template #actions>
				<UButton
					:label="$t('settings.discord.signIn.action')"
					icon="i-tabler-brand-steam"
					@click="login('steam')"
				/>
			</template>
		</UAlert>

		<UCard v-else class="overflow-hidden rounded-2xl border-border/80 bg-card/90 shadow-sm">
			<template #header>
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-start gap-3">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/12 text-[#5865F2]">
							<TablerIcon name="brand-discord" class="size-6" />
						</div>
						<div>
							<h2 class="text-lg font-semibold text-highlighted">
								{{ $t('settings.discord.account.title') }}
							</h2>
							<p class="mt-1 text-sm text-muted">
								{{ $t('settings.discord.account.description') }}
							</p>
						</div>
					</div>
					<UBadge :color="linked ? 'success' : 'neutral'" variant="soft">
						{{
							$t(
								linked
									? 'settings.discord.account.status.linked'
									: 'settings.discord.account.status.notLinked',
							)
						}}
					</UBadge>
				</div>
			</template>

			<div v-if="linked" class="space-y-5">
				<div class="rounded-xl border border-border bg-muted/25 p-4">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted">
						{{ $t('settings.discord.account.userId') }}
					</p>
					<p class="mt-1 font-mono text-sm text-highlighted">{{ discordId }}</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<UButton
						:label="$t('settings.discord.account.unlink')"
						icon="i-tabler-unlink"
						color="error"
						variant="soft"
						:loading="pendingUnlink"
						@click="unlink"
					/>
					<UButton
						:label="$t('settings.discord.account.addToServer')"
						icon="i-tabler-brand-discord"
						variant="outline"
						to="https://discord.com/oauth2/authorize?client_id=1398745142260797571"
						external
						target="_blank"
						rel="noopener"
					/>
				</div>
			</div>

			<div v-else class="space-y-5">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="rounded-xl border border-border p-4">
						<p class="font-medium text-highlighted">
							{{ $t('settings.discord.automatic.title') }}
						</p>
						<p class="mt-1 text-sm text-muted">
							{{ $t('settings.discord.automatic.description') }}
						</p>
						<UButton
							class="mt-4"
							:label="$t('settings.discord.automatic.action')"
							icon="i-tabler-brand-discord"
							:to="oauthLinkUrl"
							external
						/>
					</div>
					<div class="rounded-xl border border-border p-4">
						<p class="font-medium text-highlighted">
							{{ $t('settings.discord.manual.title') }}
						</p>
						<I18nT
							keypath="settings.discord.manual.description"
							tag="p"
							class="mt-1 text-sm text-muted"
						>
							<template #command><code>/link</code></template>
						</I18nT>
						<UButton
							class="mt-4"
							:label="$t('settings.discord.manual.action')"
							icon="i-tabler-key"
							color="neutral"
							variant="soft"
							:loading="pendingCode"
							@click="generateCode"
						/>
					</div>
				</div>
				<DiscordLinkCode
					v-if="linkCode"
					:code="linkCode.code"
					:expires-at="linkCode.expiresAt"
					@refresh="generateCode"
				/>
			</div>
		</UCard>
	</div>
</template>
