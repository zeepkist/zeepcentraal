import type {
	GhostLoadState,
	GhostRecordSource,
	LoadedPlaybackGhost,
	ParsedPlaybackGhost,
} from '~/types/ghost'
import { loadGhostBinary, parseGhostCdnOrigins } from '~/utils/ghostDownload.client'
import { buildGhostVisualIdentities, type GhostIdentityLabels } from '~/utils/ghostVisualIdentity'

export type GhostPlaybackSourceOptions = {
	sources: Ref<readonly GhostRecordSource[]>
	identityLabels: GhostIdentityLabels
	locale: Ref<string>
	primaryColor: Ref<string>
	fallbackPalette: readonly string[]
}

export function useGhostPlaybackSources(options: GhostPlaybackSourceOptions) {
	const config = useRuntimeConfig()
	const states = reactive(new Map<number, GhostLoadState>())
	const parsed = shallowReactive(new Map<number, ParsedPlaybackGhost>())
	const requested = new Set<number>()
	const allowedOrigins = parseGhostCdnOrigins(String(config.public.ghostCdnOrigins))

	const loaded = computed<LoadedPlaybackGhost[]>(() => {
		const inputs = options.sources.value.flatMap((record) => {
			const ghost = parsed.get(record.recordId)
			return ghost ? [{ record, ghost }] : []
		})
		const identities = buildGhostVisualIdentities(
			inputs,
			options.identityLabels,
			options.locale.value,
			options.primaryColor.value,
			options.fallbackPalette,
		)
		const identityById = new Map(identities.map((identity) => [identity.recordId, identity]))
		return inputs.flatMap(({ record, ghost }) => {
			const identity = identityById.get(record.recordId)
			return identity ? [{ record, ghost, identity }] : []
		})
	})

	watch(
		() => options.sources.value,
		(sources) => {
			if (import.meta.server) return
			for (const source of sources) {
				if (!requested.has(source.recordId)) void load(source)
			}
		},
		{ immediate: true },
	)

	async function load(source: GhostRecordSource) {
		requested.add(source.recordId)
		if (!source.ghostUrl) {
			states.set(source.recordId, { status: 'error', message: 'missing-ghost' })
			return
		}
		states.set(source.recordId, { status: 'loading', progress: 'queued', source: null })
		try {
			const { parseGhostInWorker } = await import('~/composables/useGhostParserWorker.client')
			states.set(source.recordId, {
				status: 'loading',
				progress: 'decompressing',
				source: null,
			})
			const result = await loadGhostBinary(source, allowedOrigins, {
				parse: parseGhostInWorker,
			})
			parsed.set(source.recordId, result.ghost)
			states.set(source.recordId, {
				status: 'loaded',
				source: result.source,
				byteLength: result.byteLength,
			})
		} catch (error) {
			states.set(source.recordId, {
				status: 'error',
				message: error instanceof Error ? error.message : String(error),
			})
		}
	}

	function retry(recordId: number) {
		const source = options.sources.value.find((candidate) => candidate.recordId === recordId)
		if (!source) return
		requested.delete(recordId)
		void load(source)
	}

	return { loaded, parsed, retry, states }
}
