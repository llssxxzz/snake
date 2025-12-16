// game/systems/GameMap.js
import { GRID_COLS, GRID_ROWS } from '../config.js';

export class GameMap {
  static isInBounds(point) {
    return point.x >= 0 && point.x < GRID_COLS && point.y >= 0 && point.y < GRID_ROWS;
  }

  static willCollideWithSnakes(point, snakes, skipSnakeId = null) {
    for (const snake of snakes) {
      if (!snake.alive || snake.id === skipSnakeId) continue;
      for (const seg of snake.body) {
        if (point.x === seg.x && point.y === seg.y) {
          return true;
        }
      }
    }
    return false;
  }

  static isOccupied(point, snakes, foods) {
    for (const snake of snakes) {
      for (const seg of snake.body) {
        if (point.x === seg.x && point.y === seg.y) return true;
      }
    }
    for (const food of foods) {
      if (point.x === food.pos.x && point.y === food.pos.y) return true;
    }
    return false;
  }

  static generateSafeFoodPosition(snakes, foods) {
    let attempts = 0;
    do {
      const x = Math.floor(Math.random() * GRID_COLS);
      const y = Math.floor(Math.random() * GRID_ROWS);
      const pos = { x, y };
      if (!this.isOccupied(pos, snakes, foods)) {
        return pos;
      }
      attempts++;
      if (attempts > 200) {
        console.warn('食物生成失败，使用中心点');
        return { x: Math.floor(GRID_COLS / 2), y: Math.floor(GRID_ROWS / 2) };
      }
    } while (true);
  }
}