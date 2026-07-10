const CDN_BASE_URL = 'https://cdn.zeepki.st/'

export function buildGhostUrl(ghostUrl: string): string {
	return new URL(ghostUrl, CDN_BASE_URL).toString()
}
