// game/entities/Food.js
import { FOOD_TYPES } from '../config.js';

export class Food {
  constructor(x, y, type = 'apple') {
    this.pos = { x, y };
    this.type = type;
    const cfg = FOOD_TYPES[type];
    this.score = cfg.score;
    this.color = cfg.color;
    this.icon = cfg.icon;
  }

  toJSON() {
    return {
      pos: { ...this.pos },
      type: this.type,
      score: this.score,
      color: this.color,
      icon: this.icon
    };
  }

  static fromJSON(data) {
    return new Food(data.pos.x, data.pos.y, data.type);
  }

  static generateRandomType() {
    const rand = Math.random();
    if (rand < 0.6) return 'apple';
    if (rand < 0.9) return 'banana';
    return 'cherry';
  }
}