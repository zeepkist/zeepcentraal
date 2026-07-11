export function shouldShowAuthVerificationFailure(
	isCallback: boolean,
	pending: boolean,
	hasUser: boolean,
) {
	return isCallback && !pending && !hasUser
}
