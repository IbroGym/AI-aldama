const ALLOWED_SIMULATION_SPEEDS = [1, 5, 10, 20, 50] as const

export type SimulationSpeedMultiplier = (typeof ALLOWED_SIMULATION_SPEEDS)[number]

type ClockState = {
  multiplier: SimulationSpeedMultiplier
  anchor_real_ms: number
  anchor_sim_ms: number
}

declare global {
  // eslint-disable-next-line no-var
  var __devSimulationClockState: ClockState | undefined
}

const initClockState = (): ClockState => ({
  multiplier: 1,
  anchor_real_ms: Date.now(),
  anchor_sim_ms: Date.now(),
})

function getClockStateRef(): ClockState {
  if (!globalThis.__devSimulationClockState) {
    globalThis.__devSimulationClockState = initClockState()
  }
  return globalThis.__devSimulationClockState
}

function setClockState(next: ClockState) {
  globalThis.__devSimulationClockState = next
}

function currentSimMsAt(realNowMs: number): number {
  const clockState = getClockStateRef()
  const elapsedRealMs = realNowMs - clockState.anchor_real_ms
  return clockState.anchor_sim_ms + elapsedRealMs * clockState.multiplier
}

export function isAllowedSimulationSpeed(value: number): value is SimulationSpeedMultiplier {
  return (ALLOWED_SIMULATION_SPEEDS as readonly number[]).includes(value)
}

export function getAllowedSimulationSpeeds(): readonly SimulationSpeedMultiplier[] {
  return ALLOWED_SIMULATION_SPEEDS
}

export function getSimulationClockSnapshot() {
  const clockState = getClockStateRef()
  const real_now_ms = Date.now()
  return {
    real_now_ms,
    sim_now_ms: currentSimMsAt(real_now_ms),
    simulation_speed_multiplier: clockState.multiplier,
  }
}

export function setSimulationSpeedMultiplier(next: SimulationSpeedMultiplier) {
  const now = Date.now()
  const simNow = currentSimMsAt(now)
  const nextState: ClockState = {
    multiplier: next,
    anchor_real_ms: now,
    anchor_sim_ms: simNow,
  }
  setClockState(nextState)
  return {
    simulation_speed_multiplier: nextState.multiplier,
    sim_now_ms: simNow,
    real_now_ms: now,
  }
}
