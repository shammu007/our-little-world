import type { Interactable } from '../state/store'

const registry = new Map<string, Interactable>()

export function registerInteractable(i: Interactable) {
  registry.set(i.id, i)
  return () => {
    if (registry.get(i.id) === i) registry.delete(i.id)
  }
}

/**
 * Picks the closest interactable within its radius, favouring things in front
 * of the player so the prompt matches what you are looking at.
 */
export function findFocus(pos: [number, number, number], yaw: number): Interactable | null {
  let best: Interactable | null = null
  let bestScore = Infinity
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  for (const it of registry.values()) {
    const dx = it.position[0] - pos[0]
    const dz = it.position[2] - pos[2]
    const d = Math.hypot(dx, dz)
    if (d > it.radius) continue
    const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1
    const score = d - facing * 0.8
    if (score < bestScore) {
      bestScore = score
      best = it
    }
  }
  return best
}

export function getInteractable(id: string) {
  return registry.get(id)
}
