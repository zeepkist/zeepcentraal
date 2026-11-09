import { lobbyDuration } from '~/utils/lobbyAnalytics'

export function useLobbyFormat() {
	const { locale, t } = useAppI18n()
	const mounted = shallowRef(false)
	onMounted(() => {
		mounted.value = true
	})
	const number = (value: unknown) =>
		value == null
			? t('common.unavailable')
			: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(
					Number(value),
				)
	const date = (value: unknown) =>
		typeof value === 'string' && Number.isFinite(Date.parse(value))
			? new Intl.DateTimeFormat(locale.value, {
					dateStyle: 'medium',
					timeStyle: 'long',
					...(!mounted.value ? { timeZone: 'UTC' } : {}),
				}).format(new Date(value))
			: t('common.unavailable')
	const duration = (start: string, end: string | null | undefined, now: number) =>
		t('lobby.analytics.durationValue', lobbyDuration(start, end, now))
	return { number, date, duration, mounted }
}
