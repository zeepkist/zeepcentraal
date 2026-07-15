import type { OmniSearchLevelResult, OmniSearchUserResult } from '~/types/app'

export const OMNI_SEARCH_MINIMUM_LENGTH = 2
export const OMNI_SEARCH_DEBOUNCE_MS = 250

export function sortOmniSearchUsers(
	ranked: OmniSearchUserResult[],
	unranked: OmniSearchUserResult[],
	locale: string,
): OmniSearchUserResult[] {
	const names = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
	return [
		...ranked.toSorted(
			(left, right) =>
				(left.rank ?? Number.POSITIVE_INFINITY) -
					(right.rank ?? Number.POSITIVE_INFINITY) ||
				names.compare(left.name, right.name),
		),
		...unranked.toSorted((left, right) => names.compare(left.name, right.name)),
	]
}

export function sortOmniSearchLevels(
	levels: OmniSearchLevelResult[],
	locale: string,
): OmniSearchLevelResult[] {
	const names = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
	return levels.toSorted(
		(left, right) =>
			(right.points ?? Number.NEGATIVE_INFINITY) -
				(left.points ?? Number.NEGATIVE_INFINITY) || names.compare(left.name, right.name),
	)
}
