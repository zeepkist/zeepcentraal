export type DashboardHeroState = 'anonymous' | 'pending' | 'new-player' | 'active-player'

export function resolveDashboardHeroState(
	authenticated: boolean,
	viewerResolved: boolean,
	recordCount?: number,
): DashboardHeroState {
	if (!authenticated) return 'anonymous'
	if (!viewerResolved) return 'pending'
	return (recordCount ?? 0) > 0 ? 'active-player' : 'new-player'
}
