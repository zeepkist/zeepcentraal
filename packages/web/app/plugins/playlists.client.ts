export default defineNuxtPlugin(() => {
	const playlists = usePlaylistsStore()
	onNuxtReady(() => void playlists.hydrate())
})
