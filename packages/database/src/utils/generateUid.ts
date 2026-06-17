import { monotonicFactory } from 'ulid'

const ulid = monotonicFactory()

export const generateUid = () => {
	return ulid(Date.now())
}
