type TurnstileApi = {
	render: (
		container: HTMLElement,
		options: {
			action: string
			appearance: 'always'
			callback: (token: string) => void
			'error-callback': () => void
			'expired-callback': () => void
			sitekey: string
			size: 'flexible'
			theme: 'auto'
		},
	) => string
	remove: (widgetId: string) => void
	reset: (widgetId: string) => void
}

interface Window {
	turnstile?: TurnstileApi
}
