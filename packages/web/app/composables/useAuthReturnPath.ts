import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { AUTH_RETURN_PATH_STORAGE_KEY, resolveAuthReturnPath } from '~/utils/auth-return-path'

export function useAuthReturnPath() {
	const returnPath = useLocalStorage<string | null>(AUTH_RETURN_PATH_STORAGE_KEY, null, {
		flush: 'sync',
		listenToStorageChanges: false,
		onError: () => undefined,
		serializer: StorageSerializers.string,
		writeDefaults: false,
	})

	function save(fullPath: string) {
		if (!import.meta.client) return
		try {
			returnPath.value = fullPath
		} catch {
			// Storage failures must not block external authentication.
		}
	}

	function consume() {
		if (!import.meta.client) return null
		try {
			const savedPath = returnPath.value
			returnPath.value = null
			return resolveAuthReturnPath(savedPath, window.location.origin)
		} catch {
			return null
		}
	}

	return { consume, save }
}
