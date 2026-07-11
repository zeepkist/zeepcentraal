declare module '*.graphql' {
	import type { DocumentNode } from 'graphql'

	const document: DocumentNode
	export default document
}
