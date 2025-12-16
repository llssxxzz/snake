// game/utils.js
export function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function isEqual(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

export const DIRECTIONS = {
  UP:    { dx: 0, dy: -1 },
  DOWN:  { dx: 0, dy: 1 },
  LEFT:  { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 }
};

export function getOppositeDir(dir) {
  const map = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
  return map[dir] || dir;
}