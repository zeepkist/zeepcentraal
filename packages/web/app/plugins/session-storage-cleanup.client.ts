const legacyStorageKey = 'zeepcentraal_session'

export default defineNuxtPlugin(() => {
	localStorage.removeItem(legacyStorageKey)
})
