import { nextTick } from 'vue'
import {
	resolveSharedViewTransitionDirection,
	type SharedViewTransitionDirection,
} from '~/utils/sharedViewTransition'

type ViewTransitionTypes = {
	add: (type: string) => void
}

export default defineNuxtPlugin((nuxtApp) => {
	const router = useRouter()
	const transitionState = useSharedViewTransition()
	let direction: SharedViewTransitionDirection | null = null

	router.beforeEach(async (to, from) => {
		direction = resolveSharedViewTransitionDirection(
			transitionState.selection.value,
			from.fullPath,
			to.fullPath,
		)
		if (direction) {
			await nextTick()
			return
		}
		if (!transitionState.selection.value) return
		transitionState.clear()
		await nextTick()
	})

	nuxtApp.hook('page:view-transition:start', (transition) => {
		const activeDirection = direction
		if (activeDirection) {
			const types = (transition as ViewTransition & { types?: ViewTransitionTypes }).types
			types?.add(activeDirection)
		}
		const finish = () => {
			if (activeDirection === 'detail-back') transitionState.clear()
			if (direction === activeDirection) direction = null
		}
		void transition.finished.then(finish, () => {
			transitionState.clear()
			finish()
		})
	})

	router.afterEach((_to, _from, failure) => {
		if (failure) {
			transitionState.clear()
			direction = null
			return
		}
		if (!document.startViewTransition && direction === 'detail-back') {
			transitionState.clear()
			direction = null
		}
	})

	router.onError(() => {
		transitionState.clear()
		direction = null
	})
})
