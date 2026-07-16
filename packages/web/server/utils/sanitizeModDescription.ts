import sanitizeHtml from 'sanitize-html'

export function sanitizeModDescription(value: string | undefined): string {
	return sanitizeHtml(value ?? '', {
		allowedTags: [
			'p',
			'br',
			'strong',
			'em',
			'b',
			'i',
			'u',
			's',
			'blockquote',
			'ul',
			'ol',
			'li',
			'h2',
			'h3',
			'h4',
			'code',
			'pre',
			'a',
			'hr',
		],
		allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
		allowedSchemes: ['http', 'https'],
		transformTags: {
			a: (_tagName, attributes) => ({
				tagName: 'a',
				attribs: { ...attributes, target: '_blank', rel: 'noopener noreferrer nofollow' },
			}),
		},
	})
}
