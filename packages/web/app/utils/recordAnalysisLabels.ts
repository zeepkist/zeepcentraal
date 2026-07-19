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
		focusSeriesLabel: (player: string) => string
		clearFocusLabel: (player: string) => string
		steeringLeftLabel: string
		steeringRightLabel: string
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
		config: Record<
			GhostEventKind,
			{ label: string; description?: string; icon: string; color: string }
		>
	}
	airControl: {
		title: string
		description: string
		icon: string
		primary: string
		detailsTitle: string
		unavailableLabel: string
		observedLabel: string
		labels: {
			run: string
			airborneDuration: string
			airSteering: string
			left: string
			right: string
			events: string
			airborneShare: string
			angularVelocityReduction: string
			uprightImprovement: string
			verticalTravel: string
			rotation: string
			rotationRate: string
		}
		controls: {
			braking: { title: string; description: string; icon: string }
			armsUp: { title: string; description: string; icon: string }
			steeringLeft: { title: string; description: string; icon: string }
			steeringRight: { title: string; description: string; icon: string }
		}
		units: {
			seconds: string
			metres: string
			degrees: string
			degreesPerSecond: string
			radiansPerSecond: string
		}
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
			run: string
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
	const airControl = (key: string) => t(`pages.recordDetail.analysis.airControl.${key}`)
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
			focusSeriesLabel: (player) =>
				t('pages.recordDetail.analysis.telemetry.focusSeries', { player }),
			clearFocusLabel: (player) =>
				t('pages.recordDetail.analysis.telemetry.clearFocus', { player }),
			steeringLeftLabel: telemetry('steeringLeft'),
			steeringRightLabel: telemetry('steeringRight'),
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
				'air-arms-up': {
					label: events('kinds.airArmsUp'),
					description: airControl('controls.armsUp.description'),
					icon: 'arrow-down-from-arc',
					color: '#8b5cf6',
				},
				'air-braking': {
					label: events('kinds.airBraking'),
					description: airControl('controls.braking.description'),
					icon: 'rotate-clockwise-2',
					color: '#e11d48',
				},
				'air-steering-left': {
					label: events('kinds.airSteeringLeft'),
					description: airControl('controls.steeringLeft.description'),
					icon: 'rotate-2',
					color: '#60a5fa',
				},
				'air-steering-right': {
					label: events('kinds.airSteeringRight'),
					description: airControl('controls.steeringRight.description'),
					icon: 'rotate-clockwise-2',
					color: '#2dd4bf',
				},
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
		airControl: {
			title: airControl('title'),
			description: airControl('description'),
			icon: 'plane-tilt',
			primary: airControl('primary'),
			detailsTitle: airControl('detailsTitle'),
			unavailableLabel: t('common.unavailable'),
			observedLabel: airControl('observed'),
			labels: {
				run: t('pages.recordDetail.telemetry.submittedRuns'),
				airborneDuration: airControl('airborneDuration'),
				airSteering: airControl('airSteering'),
				left: airControl('left'),
				right: airControl('right'),
				events: airControl('events'),
				airborneShare: airControl('airborneShare'),
				angularVelocityReduction: airControl('angularVelocityReduction'),
				uprightImprovement: airControl('uprightImprovement'),
				verticalTravel: airControl('verticalTravel'),
				rotation: airControl('rotation'),
				rotationRate: airControl('rotationRate'),
			},
			controls: {
				braking: {
					title: airControl('controls.braking.title'),
					description: airControl('controls.braking.description'),
					icon: 'hand-stop',
				},
				armsUp: {
					title: airControl('controls.armsUp.title'),
					description: airControl('controls.armsUp.description'),
					icon: 'arrow-down-from-arc',
				},
				steeringLeft: {
					title: airControl('controls.steeringLeft.title'),
					description: airControl('controls.steeringLeft.description'),
					icon: 'rotate-2',
				},
				steeringRight: {
					title: airControl('controls.steeringRight.title'),
					description: airControl('controls.steeringRight.description'),
					icon: 'rotate-clockwise-2',
				},
			},
			units: {
				seconds: t('dashboard.totals.units.seconds'),
				metres: t('dashboard.totals.units.metres'),
				degrees: airControl('units.degrees'),
				degreesPerSecond: airControl('units.degreesPerSecond'),
				radiansPerSecond: t('dashboard.totals.units.radiansPerSecond'),
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
				run: t('pages.recordDetail.telemetry.submittedRuns'),
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
