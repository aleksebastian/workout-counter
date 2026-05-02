export function haptic(pattern: VibratePattern = 50): void {
	if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		navigator.vibrate(pattern);
	}
}

export const HAPTIC = {
	/** Very short tap — button press acknowledgement */
	tap: () => haptic(30),
	/** Medium tap — recording a set */
	medium: () => haptic(60),
	/** Heavy — delete / destructive */
	heavy: () => haptic(90),
	/** Double pulse — success / PR */
	success: () => haptic([60, 40, 60]),
	/** Triple pulse — timer expired */
	timerDone: () => haptic([80, 50, 80, 50, 80])
} as const;
