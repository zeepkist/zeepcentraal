import { MaterialPhysicsState, V6SurfaceState } from './enums'

export const KNOWN_SURFACES = [
	'tarmac',
	'grass',
	'sand',
	'soap',
	'wood',
	'mud',
	'ice1',
	'ice2',
	'ice3',
] as const

export type KnownSurface = (typeof KNOWN_SURFACES)[number]

export function surfacesFromV6State(surfaceState: number): KnownSurface[] {
	const surfaces: KnownSurface[] = []
	if ((surfaceState & V6SurfaceState.Grass) !== 0) surfaces.push('grass')
	if ((surfaceState & V6SurfaceState.Sand) !== 0 || (surfaceState & V6SurfaceState.Snow) !== 0) {
		surfaces.push('sand')
	}
	if ((surfaceState & V6SurfaceState.Ice) !== 0) surfaces.push('ice1')
	if ((surfaceState & V6SurfaceState.Soap) !== 0) surfaces.push('soap')
	if ((surfaceState & V6SurfaceState.Mud) !== 0 || (surfaceState & V6SurfaceState.Flesh) !== 0) {
		surfaces.push('mud')
	}
	if (
		surfaces.length === 0 ||
		(surfaceState & (V6SurfaceState.Tarmac | V6SurfaceState.Metal | V6SurfaceState.Wood)) !== 0
	) {
		surfaces.unshift('tarmac')
	}
	return [...new Set(surfaces)]
}

export function surfacesFromV7State(materialPhysicsState: number): KnownSurface[] {
	const surfaces: KnownSurface[] = []
	if ((materialPhysicsState & MaterialPhysicsState.Tarmac) !== 0) surfaces.push('tarmac')
	if ((materialPhysicsState & MaterialPhysicsState.Grass) !== 0) surfaces.push('grass')
	if ((materialPhysicsState & MaterialPhysicsState.Sand) !== 0) surfaces.push('sand')
	if ((materialPhysicsState & MaterialPhysicsState.Soap) !== 0) surfaces.push('soap')
	if ((materialPhysicsState & MaterialPhysicsState.Wood) !== 0) surfaces.push('wood')
	if ((materialPhysicsState & MaterialPhysicsState.Mud) !== 0) surfaces.push('mud')
	if ((materialPhysicsState & MaterialPhysicsState.Ice1) !== 0) surfaces.push('ice1')
	if ((materialPhysicsState & MaterialPhysicsState.Ice2) !== 0) surfaces.push('ice2')
	if ((materialPhysicsState & MaterialPhysicsState.Ice3) !== 0) surfaces.push('ice3')
	return surfaces
}

export function surfacesFromState(surfaceState: number, version: 6 | 7): KnownSurface[] {
	return version === 6 ? surfacesFromV6State(surfaceState) : surfacesFromV7State(surfaceState)
}
