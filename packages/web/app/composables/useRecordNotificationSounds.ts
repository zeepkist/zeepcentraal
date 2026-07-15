import type { Ref } from 'vue'
import type { RecordHistoryUpdate } from '~/types/app'
import { RECORD_NOTIFICATION_TONES, selectRecordNotificationKind } from '~/utils/recordNotification'

const SOUND_ENABLED_KEY = 'record-notification-sound-enabled'
const ONLY_MINE_KEY = 'record-notification-only-mine'

type RecordNotificationSoundOptions = {
	batch: Ref<RecordHistoryUpdate | null>
	viewerUserId?: Ref<number | undefined>
	allowOnlyMine?: boolean
}

export function useRecordNotificationSounds(options: RecordNotificationSoundOptions) {
	const enabled = useState('record-notification-sound-enabled', () => false)
	const onlyMine = useState('record-notification-only-mine', () => false)
	const preferencesLoaded = useState('record-notification-preferences-loaded', () => false)
	let audioContext: AudioContext | null = null

	function persist(key: string, value: boolean) {
		if (import.meta.client) localStorage.setItem(key, value ? '1' : '0')
	}

	function context() {
		if (!import.meta.client) return null
		audioContext ??= new AudioContext()
		return audioContext
	}

	async function unlockAudio() {
		if (!enabled.value) return
		const current = context()
		if (current?.state === 'suspended') await current.resume().catch(() => undefined)
	}

	function play(kind: keyof typeof RECORD_NOTIFICATION_TONES) {
		const current = context()
		if (!current) return
		void current
			.resume()
			.then(() => {
				const start = current.currentTime + 0.01
				for (const tone of RECORD_NOTIFICATION_TONES[kind]) {
					const oscillator = current.createOscillator()
					const gain = current.createGain()
					const toneStart = start + tone.offset
					const toneEnd = toneStart + tone.duration
					oscillator.type = kind === 'world-record' ? 'triangle' : 'sine'
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
			.catch(() => undefined)
	}

	function setEnabled(value: boolean) {
		enabled.value = value
		persist(SOUND_ENABLED_KEY, value)
		if (value) void unlockAudio()
	}

	function setOnlyMine(value: boolean) {
		onlyMine.value = value
		persist(ONLY_MINE_KEY, value)
	}

	watch(options.batch, (batch) => {
		if (!batch || !enabled.value) return
		const onlyUserId =
			options.allowOnlyMine && onlyMine.value ? options.viewerUserId?.value : undefined
		const kind = selectRecordNotificationKind(batch.records, onlyUserId)
		if (kind) play(kind)
	})

	onMounted(() => {
		if (!preferencesLoaded.value) {
			enabled.value = localStorage.getItem(SOUND_ENABLED_KEY) === '1'
			onlyMine.value = localStorage.getItem(ONLY_MINE_KEY) === '1'
			preferencesLoaded.value = true
		}
		window.addEventListener('pointerdown', unlockAudio, { once: true })
		window.addEventListener('keydown', unlockAudio, { once: true })
	})

	onScopeDispose(() => {
		if (!import.meta.client) return
		window.removeEventListener('pointerdown', unlockAudio)
		window.removeEventListener('keydown', unlockAudio)
		if (audioContext) void audioContext.close()
	})

	return { enabled, onlyMine, setEnabled, setOnlyMine }
}
