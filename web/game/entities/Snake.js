// game/entities/Snake.js
import { DIRECTIONS, getOppositeDir } from '../utils.js';

export class Snake {
  constructor(id, x, y, direction = 'RIGHT', color, isAI = false) {
    this.id = id;
    this.body = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
    this.direction = direction;
    this.nextDirection = direction;
    this.score = 0;
    this.alive = true;
    this.isAI = isAI;
    this.color = color;
  }

  get head() {
    return this.body[0];
  }

  move(newHead, willGrow = false) {
    if (!this.alive) return;
    if (willGrow) {
      this.body.unshift(newHead);
    } else {
      this.body.pop();
      this.body.unshift(newHead);
    }
    this.direction = this.nextDirection;
  }

  setNextDirection(dir) {
    if (this.isValidDirection(dir)) {
      this.nextDirection = dir;
      return true;
    }
    return false;
  }

  isValidDirection(dir) {
    return dir !== getOppositeDir(this.direction) && dir !== this.direction;
  }

  simulateMove(dir) {
    const { x, y } = this.head;
    const d = DIRECTIONS[dir];
    return { x: x + d.dx, y: y + d.dy };
  }

  toJSON() {
    return {
      id: this.id,
      body: this.body.map(p => ({...p})),
      direction: this.direction,
      nextDirection: this.nextDirection,
      score: this.score,
      alive: this.alive,
      isAI: this.isAI,
      color: this.color
    };
  }

  static fromJSON(data) {
    const snake = new Snake(
      data.id,
      data.body[0].x,
      data.body[0].y,
      data.direction,
      data.color,
      data.isAI
    );
    snake.body = data.body.map(p => ({...p}));
    snake.nextDirection = data.nextDirection;
    snake.score = data.score;
    snake.alive = data.alive;
    return snake;
  }
}