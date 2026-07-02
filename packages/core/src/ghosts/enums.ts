export const InputFlags = {
	None: 0,
	ArmsUp: 1 << 0,
	Braking: 1 << 1,
	Horn: 1 << 2,
} as const

export const SoapboxFlags = {
	None: 0,
	Soap: 1 << 0,
	Offroad: 1 << 1,
	Paraglider: 1 << 2,
	FrontLeft: 1 << 3,
	FrontRight: 1 << 4,
	RearLeft: 1 << 5,
	RearRight: 1 << 6,
} as const

export const WheelFlags = {
	HasNone: 0,
	HasFrontLeft: 1 << 0,
	HasFrontRight: 1 << 1,
	HasRearLeft: 1 << 2,
	HasRearRight: 1 << 3,
	HasFront: (1 << 0) | (1 << 1),
	HasRear: (1 << 2) | (1 << 3),
	HasAll: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3),
} as const

export const GroundedWheelState = WheelFlags
export const SlippingWheelState = WheelFlags

export const SurfaceState = {
	None: 0,
	Tarmac: 1 << 0,
	Grass: 1 << 1,
	Sand: 1 << 2,
	Snow: 1 << 3,
	Ice: 1 << 4,
	Soap: 1 << 5,
	Metal: 1 << 6,
} as const

export type BitwiseEnumValue = number
