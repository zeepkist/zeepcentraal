interface DiscordLinkCode {
	code: string
	expiresAt: string
}

export function useDiscordSettings() {
	const config = useRuntimeConfig()
	const route = useRoute()
	const session = useSessionStore()
	const toast = useToast()
	const { t } = useI18n()
	const pendingCode = ref(false)
	const pendingUnlink = ref(false)
	const linkCode = ref<DiscordLinkCode | null>(null)
	const discordId = computed(() => {
		const value = session.user?.discordId
		return value && value !== '-1' ? value : null
	})
	const linked = computed(() => discordId.value !== null)
	const oauthLinkUrl = computed(
		() => `${config.public.backendUrl.replace(/\/$/, '')}/auth/discord/link/redirect`,
	)

	async function generateCode() {
		pendingCode.value = true
		try {
			linkCode.value = await $fetch<DiscordLinkCode, string>('/api/discord/link-code', {
				method: 'POST',
				credentials: 'include',
			})
		} catch {
			toast.add({
				title: t('settings.discord.toasts.codeGenerationFailed.title'),
				description: t('settings.discord.toasts.codeGenerationFailed.description'),
				color: 'error',
			})
		} finally {
			pendingCode.value = false
		}
	}

	async function unlink() {
		pendingUnlink.value = true
		try {
			await $fetch('/api/discord', { method: 'DELETE', credentials: 'include' })
			if (session.user) session.setUser({ ...session.user, discordId: '-1' })
			linkCode.value = null
			toast.add({
				title: t('settings.discord.toasts.unlinked.title'),
				color: 'success',
			})
		} catch {
			toast.add({
				title: t('settings.discord.toasts.unlinkFailed.title'),
				description: t('settings.discord.toasts.unlinkFailed.description'),
				color: 'error',
			})
		} finally {
			pendingUnlink.value = false
		}
	}

	onMounted(() => {
		if (route.query.linked === '1') {
			toast.add({
				title: t('settings.discord.toasts.linked.title'),
				description: t('settings.discord.toasts.linked.description'),
				color: 'success',
			})
		}
		if (typeof route.query.discordLinkError === 'string') {
			toast.add({
				title: t('settings.discord.toasts.linkFailed.title'),
				description: route.query.discordLinkError,
				color: 'error',
			})
		}
	})

	return {
		discordId,
		generateCode,
		linkCode,
		linked,
		oauthLinkUrl,
		pendingCode,
		pendingUnlink,
		session,
		unlink,
	}
}
