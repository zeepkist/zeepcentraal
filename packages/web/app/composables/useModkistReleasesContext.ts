import type { InjectionKey, Ref } from 'vue'
import type { ModkistReleases } from '~/types/modkist'

export const modkistReleasesKey: InjectionKey<Readonly<Ref<ModkistReleases | null>>> =
	Symbol('modkist-releases')

export function useModkistReleasesContext() {
	return inject(modkistReleasesKey, readonly(ref<ModkistReleases | null>(null)))
}
