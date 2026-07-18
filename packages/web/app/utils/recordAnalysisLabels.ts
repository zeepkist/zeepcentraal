import type { GhostEventKind } from '~/types/ghost'
import type { RecordCoachingSignal, RecordTelemetryMetricKey } from './recordGhostAnalysis'

type Translate = {
	(key: string): string
	(key: string, named: Record<string, unknown>): string
}

export type RecordCapabilityLabels = {
	title: string
	description: (version: number) => string
	featuresLabel: string
	features: Record<string, string>
}

export type RecordAnalysisLabels = {
	telemetry: {
		primary: string
		emptyLabel: string
		secondsUnit: string
		config: Record<
			RecordTelemetryMetricKey,
			{
				title: string
				description: string
				icon: string
				unit: string
				maximumFractionDigits: number
			}
		>
	}
	events: {
		title: string
		description: string
		icon: string
		emptyLabel: string
		atLabel: string
		durationLabel: string
		secondsUnit: string
		config: Record<GhostEventKind, { label: string; icon: string; color: string }>
	}
	drift: {
		title: string
		description: string
		icon: string
		emptyLabel: string
		comparisonTitle: string
		eventsTitle: string
		primary: string
		unavailableLabel: string
		labels: {
			eventCount: string
			totalDuration: string
			totalDistance: string
			speedRetention: string
			worstRetention: string
			distance: string
		}
		units: { seconds: string; metres: string }
	}
	coaching: {
		title: string
		description: string
		icon: string
		emptyLabel: string
		unavailableLabel: string
		secondsUnit: string
		speedUnit: string
		insights: Record<
			RecordCoachingSignal['kind'],
			{
				title: string
				description: (value: string) => string
				icon: string
			}
		>
	}
}

export function createRecordCapabilityLabels(t: Translate): RecordCapabilityLabels {
	return {
		title: t('pages.recordDetail.capabilities.title'),
		description: (version) => t('pages.recordDetail.capabilities.description', { version }),
		featuresLabel: t('pages.recordDetail.capabilities.featuresLabel'),
		features: {
			inputs: t('pages.recordDetail.capabilities.features.inputs'),
			air: t('pages.recordDetail.capabilities.features.air'),
			wheels: t('pages.recordDetail.capabilities.features.wheels'),
			slip: t('pages.recordDetail.capabilities.features.slip'),
			state: t('pages.recordDetail.capabilities.features.state'),
			surfaces: t('pages.recordDetail.capabilities.features.surfaces'),
			velocity: t('pages.recordDetail.capabilities.features.velocity'),
			ragdoll: t('pages.recordDetail.capabilities.features.ragdoll'),
			orientation: t('pages.recordDetail.capabilities.features.orientation'),
		},
	}
}

export function createRecordAnalysisLabels(t: Translate): RecordAnalysisLabels {
	const telemetry = (key: string) => t(`pages.recordDetail.analysis.telemetry.${key}`)
	const events = (key: string) => t(`pages.recordDetail.analysis.events.${key}`)
	const drift = (key: string) => t(`pages.recordDetail.analysis.drift.${key}`)
	const coaching = (key: string) => t(`pages.recordDetail.analysis.coaching.${key}`)
	const insight = (key: string) => ({
		title: coaching(`insights.${key}.title`),
		description: (value: string) =>
			t(`pages.recordDetail.analysis.coaching.insights.${key}.description`, { value }),
	})
	return {
		telemetry: {
			primary: telemetry('primary'),
			emptyLabel: telemetry('empty'),
			secondsUnit: t('dashboard.totals.units.seconds'),
			config: {
				speed: {
					title: telemetry('speed.title'),
					description: telemetry('speed.description'),
					icon: 'gauge',
					unit: t('dashboard.totals.units.kilometresPerHour'),
					maximumFractionDigits: 1,
				},
				steering: {
					title: telemetry('steering.title'),
					description: telemetry('steering.description'),
					icon: 'steering-wheel',
					unit: '',
					maximumFractionDigits: 2,
				},
				'lateral-velocity': {
					title: telemetry('lateralVelocity.title'),
					description: telemetry('lateralVelocity.description'),
					icon: 'arrows-left-right',
					unit: t('dashboard.totals.units.metresPerSecond'),
					maximumFractionDigits: 1,
				},
				'longitudinal-velocity': {
					title: telemetry('longitudinalVelocity.title'),
					description: telemetry('longitudinalVelocity.description'),
					icon: 'arrows-up-down',
					unit: t('dashboard.totals.units.metresPerSecond'),
					maximumFractionDigits: 1,
				},
				'angular-velocity': {
					title: telemetry('angularVelocity.title'),
					description: telemetry('angularVelocity.description'),
					icon: 'rotate-360',
					unit: t('dashboard.totals.units.radiansPerSecond'),
					maximumFractionDigits: 2,
				},
				'g-force': {
					title: telemetry('gForce.title'),
					description: telemetry('gForce.description'),
					icon: 'activity',
					unit: t('dashboard.totals.units.g'),
					maximumFractionDigits: 2,
				},
			},
		},
		events: {
			title: events('title'),
			description: events('description'),
			icon: 'timeline-event',
			emptyLabel: events('empty'),
			atLabel: events('at'),
			durationLabel: events('duration'),
			secondsUnit: t('dashboard.totals.units.seconds'),
			config: {
				'arms-up': {
					label: events('kinds.armsUp'),
					icon: 'arrow-down-from-arc',
					color: '#a78bfa',
				},
				braking: { label: events('kinds.braking'), icon: 'hand-stop', color: '#f43f5e' },
				horn: { label: events('kinds.horn'), icon: 'volume', color: '#f59e0b' },
				paraglider: {
					label: events('kinds.paraglider'),
					icon: 'parachute',
					color: '#38bdf8',
				},
				soap: { label: events('kinds.soap'), icon: 'bubble', color: '#ec4899' },
				offroad: { label: events('kinds.offroad'), icon: 'road-off', color: '#84cc16' },
				airborne: { label: events('kinds.airborne'), icon: 'plane-tilt', color: '#22d3ee' },
				slipping: { label: events('kinds.slipping'), icon: 'wind', color: '#fb923c' },
				ragdoll: { label: events('kinds.ragdoll'), icon: 'run', color: '#ef4444' },
				parking: { label: events('kinds.parking'), icon: 'parking', color: '#64748b' },
				monorail: { label: events('kinds.monorail'), icon: 'train', color: '#14b8a6' },
			},
		},
		drift: {
			title: drift('title'),
			description: drift('description'),
			icon: 'wind',
			emptyLabel: drift('empty'),
			comparisonTitle: drift('comparisonTitle'),
			eventsTitle: drift('eventsTitle'),
			primary: drift('primary'),
			unavailableLabel: t('common.unavailable'),
			labels: {
				eventCount: drift('eventCount'),
				totalDuration: drift('totalDuration'),
				totalDistance: drift('totalDistance'),
				speedRetention: drift('speedRetention'),
				worstRetention: drift('worstRetention'),
				distance: drift('distance'),
			},
			units: {
				seconds: t('dashboard.totals.units.seconds'),
				metres: t('dashboard.totals.units.metres'),
			},
		},
		coaching: {
			title: coaching('title'),
			description: coaching('description'),
			icon: 'bulb',
			emptyLabel: coaching('empty'),
			unavailableLabel: t('common.unavailable'),
			secondsUnit: t('dashboard.totals.units.seconds'),
			speedUnit: t('dashboard.totals.units.kilometresPerHour'),
			insights: {
				'strong-speed-retention': {
					...insight('strongSpeedRetention'),
					icon: 'trending-up',
				},
				'drift-speed-loss': { ...insight('driftSpeedLoss'), icon: 'trending-down' },
				'long-drift': { ...insight('longDrift'), icon: 'clock' },
				'late-braking': { ...insight('lateBraking'), icon: 'hand-stop' },
				'low-input-section': { ...insight('lowInputSection'), icon: 'steering-wheel-off' },
				'comparison-speed-deficit': {
					...insight('comparisonSpeedDeficit'),
					icon: 'chart-arrows-vertical',
				},
			},
		},
	}
}
