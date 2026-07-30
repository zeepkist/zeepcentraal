export const SHARED_VIEW_TRANSITION_PARTS = {
	media: 'shared-media',
	title: 'shared-title',
	metric: 'shared-metric',
} as const

export type SharedViewTransitionPart = keyof typeof SHARED_VIEW_TRANSITION_PARTS

export type SharedViewTransitionEntity =
	| 'level'
	| 'mod'
	| 'tournament'
	| 'user'
	| 'record'
	| 'zsl-season'
	| 'zsl-round'
	| 'zsl-level'

export type SharedViewTransitionPreview = {
	title: string
	subtitle?: string | null
	mediaUrl?: string | null
	mediaAlt?: string
	metric?: string | null
}

export type SharedViewTransitionSelection = {
	entity: SharedViewTransitionEntity
	entityId: string
	sourceKey: string
	sourceRoute: string
	targetRoute: string
	preview: SharedViewTransitionPreview
}

export type SharedViewTransitionDirection = 'detail-forward' | 'detail-back'

export function createSharedViewTransitionSourceKey(
	route: string,
	scope: string,
	entity: SharedViewTransitionEntity,
	entityId: string | number,
) {
	return `${route}:${scope}:${entity}:${entityId}`
}

export function isSharedViewTransitionActivation(event: MouseEvent) {
	return (
		event.button === 0 &&
		!event.defaultPrevented &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey
	)
}

export function resolveSharedViewTransitionDirection(
	selection: SharedViewTransitionSelection | null,
	fromRoute: string,
	toRoute: string,
): SharedViewTransitionDirection | null {
	if (!selection) return null
	if (fromRoute === selection.sourceRoute && toRoute === selection.targetRoute) {
		return 'detail-forward'
	}
	if (fromRoute === selection.targetRoute && toRoute === selection.sourceRoute) {
		return 'detail-back'
	}
	return null
}

export function matchesSharedViewTransitionTarget(
	selection: SharedViewTransitionSelection | null,
	route: string,
	entity: SharedViewTransitionEntity,
	entityId: string | number,
) {
	return (
		selection?.entity === entity &&
		selection.entityId === String(entityId) &&
		selection.targetRoute === route
	)
}
