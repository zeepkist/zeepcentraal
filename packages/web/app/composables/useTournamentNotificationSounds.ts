import type { Ref } from 'vue'
import type { TournamentStanding } from '~/types/tournament'
import {
	selectTournamentNotificationKind,
	TOURNAMENT_NOTIFICATION_TONES,
} from '~/utils/tournamentNotification'

const TOURNAMENT_SOUND_KEY = 'tournament-notification-sound-enabled'

export function useTournamentNotificationSounds(
	feed: Ref<TournamentStanding[]>,
	liveEnabled: Ref<boolean>,
) {
	const enabled = useState('tournament-notification-sound-enabled', () => false)
	const loaded = useState('tournament-notification-sound-loaded', () => false)
	let audioContext: AudioContext | null = null
	let baseline = new Map<number, number>()
	let baselineInitialized = false

	function context() {
		if (!import.meta.client) return null
		audioContext ??= new AudioContext()
		return audioContext
	}

	async function unlock() {
		if (!enabled.value) return
		const current = context()
		if (current?.state === 'suspended') await current.resume().catch(() => undefined)
	}

	function setEnabled(value: boolean) {
		enabled.value = value
		if (import.meta.client) localStorage.setItem(TOURNAMENT_SOUND_KEY, value ? '1' : '0')
		if (value) void unlock()
	}

	function play(kind: keyof typeof TOURNAMENT_NOTIFICATION_TONES) {
		const current = context()
		if (!current) return
		void current.resume().then(() => {
			const start = current.currentTime + 0.01
			for (const tone of TOURNAMENT_NOTIFICATION_TONES[kind]) {
				const oscillator = current.createOscillator()
				const gain = current.createGain()
				const toneStart = start + tone.offset
				const toneEnd = toneStart + tone.duration
				oscillator.type = kind === 'first' ? 'triangle' : 'sine'
				oscillator.frequency.setValueAtTime(tone.frequency, toneStart)
				gain.gain.setValueAtTime(0.0001, toneStart)
				gain.gain.exponentialRampToValueAtTime(0.12, toneStart + 0.015)
				gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd)
				oscillator.connect(gain)
				gain.connect(current.destination)
				oscillator.start(toneStart)
				oscillator.stop(toneEnd)
			}
		})
	}

	watch(
		feed,
		(rows) => {
			const next = new Map(rows.map((row) => [row.userId, row.recordId]))
			if (!liveEnabled.value || !baselineInitialized) {
				baseline = next
				baselineInitialized = liveEnabled.value
				return
			}
			const changedRanks = rows
				.filter((row) => baseline.get(row.userId) !== row.recordId)
				.map((row) => row.rank)
			baseline = next
			if (!enabled.value) return
			const kind = selectTournamentNotificationKind(changedRanks)
			if (kind) play(kind)
		},
		{ immediate: true },
	)

	watch(liveEnabled, (active) => {
		baseline = new Map(feed.value.map((row) => [row.userId, row.recordId]))
		baselineInitialized = active
	})

	onMounted(() => {
		if (!loaded.value) {
			enabled.value = localStorage.getItem(TOURNAMENT_SOUND_KEY) === '1'
			loaded.value = true
		}
		window.addEventListener('pointerdown', unlock, { once: true })
		window.addEventListener('keydown', unlock, { once: true })
	})

	onScopeDispose(() => {
		if (!import.meta.client) return
		window.removeEventListener('pointerdown', unlock)
		window.removeEventListener('keydown', unlock)
		if (audioContext) void audioContext.close()
	})

	return { enabled, setEnabled }
}
