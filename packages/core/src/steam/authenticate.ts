import { config } from '../config'

type SteamTicketAuthResponse =
	| {
			success: true
			steamId: string
	  }
	| {
			success: false
			error: string
	  }

type SteamApiResponse = {
	response:
		| {
				error: {
					errorcode: number
					errordesc: string
				}
		  }
		| {
				params: {
					result: string
					steamid: string
					ownersteamid: string
					vacbanned: boolean
					publisherbanned: boolean
				}
		  }
}

export async function authenticateSteamUser(ticket: string): Promise<SteamTicketAuthResponse> {
	if (!config.steam.apiKey) {
		return {
			success: false,
			error: 'Steam API key is not configured.',
		}
	}

	const url =
		`https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/` +
		`?key=${config.steam.apiKey}&appid=${config.steam.appId}&ticket=${ticket}`

	try {
		const response = await fetch(url)
		if (!response.ok) {
			return { success: false, error: 'Steam API request failed.' }
		}

		const data = (await response.json()) as SteamApiResponse
		if (!('params' in data.response)) {
			return { success: false, error: 'Steam API returned an error.' }
		}

		const params = data.response.params
		if (params.publisherbanned || params.vacbanned) {
			return { success: false, error: 'Steam user is banned.' }
		}

		if (params.ownersteamid && params.ownersteamid !== params.steamid) {
			return { success: false, error: 'Steam ownership mismatch.' }
		}

		return { success: true, steamId: params.steamid }
	} catch {
		return { success: false, error: 'Steam authentication failed.' }
	}
}

export function getSteamRedirectUrl(state?: string) {
	const callbackUrl = new URL('/auth/steam/callback', config.backendUrl)
	if (state) {
		callbackUrl.searchParams.set('state', state)
	}
	const params = new URLSearchParams({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'checkid_setup',
		'openid.return_to': callbackUrl.href,
		'openid.realm': config.backendUrl,
		'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
		'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
	})

	return `https://steamcommunity.com/openid/login?${params.toString()}`
}

export interface SteamCallbackRequest {
	'openid.ns': string
	'openid.mode': string
	'openid.op_endpoint': string
	'openid.claimed_id': string
	'openid.identity': string
	'openid.return_to': string
	'openid.response_nonce': string
	'openid.assoc_handle': string
	'openid.signed': string
	'openid.sig': string
}

export async function isSteamLoginSignatureValid(query: SteamCallbackRequest): Promise<boolean> {
	if (
		query['openid.op_endpoint'] !== 'https://steamcommunity.com/openid/login' ||
		!query['openid.return_to']?.startsWith(
			new URL('/auth/steam/callback', config.backendUrl).href,
		)
	) {
		return false
	}

	const params = new URLSearchParams({
		...query,
		'openid.mode': 'check_authentication',
	})

	const response = await fetch('https://steamcommunity.com/openid/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params.toString(),
	})

	const text = await response.text()
	if (!text.includes('is_valid:true')) {
		return false
	}

	const claimedId = query['openid.claimed_id']
	const steamIdMatch = claimedId?.match(/https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/)
	return typeof steamIdMatch?.[1] === 'string'
}
