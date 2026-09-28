export type SupporterStatus = {
	isSubscriptionPayment: boolean
	tierName: string | null
}

export type SupporterMap = Readonly<Record<number, SupporterStatus>>
