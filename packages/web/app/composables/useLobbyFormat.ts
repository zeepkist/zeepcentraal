import { lobbyDuration } from '~/utils/lobbyAnalytics'

export function useLobbyFormat() {
	const { locale, t } = useAppI18n()
	const mounted = shallowRef(false)
	onMounted(() => {
		mounted.value = true
	})
	const numberFormatter = computed(
		() =>
			new Intl.NumberFormat(locale.value, {
				maximumFractionDigits: 1,
			}),
	)
	const dateFormatter = computed(
		() =>
			new Intl.DateTimeFormat(locale.value, {
				dateStyle: 'medium',
				timeStyle: 'long',
				...(!mounted.value ? { timeZone: 'UTC' } : {}),
			}),
	)
	const durationFormatter = computed(
		() => new Intl.NumberFormat(locale.value, { useGrouping: false }),
	)
	const number = (value: unknown) =>
		value == null ? t('common.unavailable') : numberFormatter.value.format(Number(value))
	const date = (value: unknown) =>
		typeof value === 'string' && Number.isFinite(Date.parse(value))
			? dateFormatter.value.format(new Date(value))
			: t('common.unavailable')
	const duration = (start: string, end: string | null | undefined, now: number) =>
		lobbyDuration(start, end, now, durationFormatter.value)
	return { number, date, duration, mounted }
}
