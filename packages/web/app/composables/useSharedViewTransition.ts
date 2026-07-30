import type { CSSProperties } from 'vue'
import {
	createSharedViewTransitionSourceKey,
	isSharedViewTransitionActivation,
	matchesSharedViewTransitionTarget,
	SHARED_VIEW_TRANSITION_PARTS,
	type SharedViewTransitionEntity,
	type SharedViewTransitionPart,
	type SharedViewTransitionPreview,
	type SharedViewTransitionSelection,
} from '~/utils/sharedViewTransition'

type BeginSharedViewTransitionOptions = {
	event: MouseEvent
	entity: SharedViewTransitionEntity
	entityId: string | number
	scope: string
	targetRoute: string
	preview: SharedViewTransitionPreview
}

export function useSharedViewTransition() {
	const route = useRoute()
	const selection = useState<SharedViewTransitionSelection | null>(
		'shared-view-transition-selection',
		() => null,
	)

	function begin(options: BeginSharedViewTransitionOptions) {
		if (import.meta.server || !isSharedViewTransitionActivation(options.event)) return
		if (
			typeof document.startViewTransition !== 'function' ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return
		}
		const entityId = String(options.entityId)
		selection.value = {
			entity: options.entity,
			entityId,
			sourceKey: createSharedViewTransitionSourceKey(
				route.fullPath,
				options.scope,
				options.entity,
				entityId,
			),
			sourceRoute: route.fullPath,
			targetRoute: options.targetRoute,
			preview: options.preview,
		}
	}

	function sourceStyle(
		scope: string,
		entity: SharedViewTransitionEntity,
		entityId: string | number,
		part: SharedViewTransitionPart,
	): CSSProperties | undefined {
		const sourceKey = createSharedViewTransitionSourceKey(
			route.fullPath,
			scope,
			entity,
			entityId,
		)
		if (selection.value?.sourceKey !== sourceKey) return undefined
		return { viewTransitionName: SHARED_VIEW_TRANSITION_PARTS[part] }
	}

	function targetStyle(
		entity: SharedViewTransitionEntity,
		entityId: string | number,
		part: SharedViewTransitionPart,
	): CSSProperties | undefined {
		if (!matchesSharedViewTransitionTarget(selection.value, route.fullPath, entity, entityId)) {
			return undefined
		}
		return { viewTransitionName: SHARED_VIEW_TRANSITION_PARTS[part] }
	}

	function preview(
		entity: SharedViewTransitionEntity,
		entityId: string | number,
	): SharedViewTransitionPreview | null {
		const value = selection.value
		return matchesSharedViewTransitionTarget(value, route.fullPath, entity, entityId)
			? (value?.preview ?? null)
			: null
	}

	function clear() {
		selection.value = null
	}

	return {
		begin,
		clear,
		preview,
		selection: readonly(selection),
		sourceStyle,
		targetStyle,
	}
}
