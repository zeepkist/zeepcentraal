<script setup vapor lang="ts">
const { t } = useI18n()
usePageSeo('support')
const akaneBenefits = computed(() => [
	{ text: t('support.akane.benefits.development'), supported: true },
	{ text: t('support.akane.benefits.adFree'), supported: true },
	{ text: t('support.akane.benefits.badge'), supported: true },
	{ text: t('support.akane.benefits.noDiscordRole'), supported: false },
	{ text: t('support.akane.benefits.noZeepkist'), supported: false },
])
const yannicBenefits = computed(() => [
	{ text: t('support.yannic.benefits.development'), supported: true },
	{ text: t('support.yannic.benefits.discordRole'), supported: true },
	{ text: t('support.yannic.benefits.noBadge'), supported: false },
	{ text: t('support.yannic.benefits.noZeepCentraal'), supported: false },
])
</script>

<template>
	<UContainer class="space-y-8 py-8 sm:py-12">
		<PageHeader :eyebrow="$t('pages.support.eyebrow')" :title="$t('pages.support.title')" :description="$t('pages.support.description')" />
		<p class="text-sm text-muted-foreground">
			{{ $t('support.discordHelp') }}
			<NuxtLink to="/settings/discord" class="font-medium text-primary underline underline-offset-4">{{ $t('support.linkDiscord') }}</NuxtLink>
		</p>
		<div class="grid items-start gap-6 lg:grid-cols-2">
			<DonationPanel id="kofi-zeepcentraal" :title="$t('support.akane.title')" :description="$t('support.akane.description')" :benefits="akaneBenefits" :notice="$t('support.akane.notice')" embed-url="https://ko-fi.com/wopian/?hidefeed=true&widget=true&embed=true&preview=true" kofi-url="https://ko-fi.com/wopian" :link-label="$t('support.openKofi')" />
			<DonationPanel id="kofi-zeepkist" :title="$t('support.yannic.title')" :description="$t('support.yannic.description')" :benefits="yannicBenefits" :notice="$t('support.yannic.notice')" embed-url="https://ko-fi.com/zeepkist/?hidefeed=true&widget=true&embed=true&preview=true" kofi-url="https://ko-fi.com/zeepkist" :link-label="$t('support.openKofi')" />
		</div>
	</UContainer>
</template>
