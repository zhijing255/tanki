export const ENEMY_TYPES = {
  normal: {
    id: 'normal',
    texture: 'enemy-tank',
    label: '普通',
    color: '#ef4444',
    health: 1,
    score: 100,
    speedMultiplier: 1,
    fireDelayMultiplier: 1,
  },
  fast: {
    id: 'fast',
    texture: 'enemy-fast',
    label: '快速',
    color: '#f97316',
    health: 1,
    score: 150,
    speedMultiplier: 1.35,
    fireDelayMultiplier: 0.85,
  },
  heavy: {
    id: 'heavy',
    texture: 'enemy-heavy',
    label: '重装',
    color: '#a78bfa',
    health: 2,
    score: 250,
    speedMultiplier: 0.75,
    fireDelayMultiplier: 1.2,
  },
  sniper: {
    id: 'sniper',
    texture: 'enemy-sniper',
    label: '狙击',
    color: '#38bdf8',
    health: 1,
    score: 200,
    speedMultiplier: 0.85,
    fireDelayMultiplier: 0.65,
  },
};

export function chooseEnemyType(weights) {
  const roll = Math.random();
  let cumulative = 0;

  for (const [type, weight] of Object.entries(weights)) {
    cumulative += weight;

    if (roll < cumulative) {
      return ENEMY_TYPES[type];
    }
  }

  return ENEMY_TYPES.normal;
}

export function scaleDelayRange(range, multiplier) {
  return range.map((value) => Math.max(1, Math.round(value * multiplier)));
}