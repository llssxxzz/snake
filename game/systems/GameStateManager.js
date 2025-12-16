// game/systems/GameStateManager.js
import { Snake } from '../entities/Snake.js';
import { Food } from '../entities/Food.js';

export class GameStateManager {
  constructor() {
    this.highScore = 0;
    this.loadHighScore();
  }

  createStateSnapshot(snakes, foods, difficulty, gameSpeedMs, mode) {
    return {
      snakes: snakes.map(s => s.toJSON()),
      foods: foods.map(f => f.toJSON()),
      difficulty,
      gameSpeedMs,
      mode,
      timestamp: Date.now()
    };
  }

  saveGameState(snapshot) {
    try {
      localStorage.setItem('snakeSavedState', JSON.stringify(snapshot));
    } catch (e) {
      console.warn('保存失败:', e);
    }
  }

  loadSavedState() {
    try {
      const raw = localStorage.getItem('snakeSavedState');
      if (!raw) return null;
      const data = JSON.parse(raw);
      
      return {
        snakes: data.snakes.map(s => Snake.fromJSON(s)),
        foods: data.foods.map(f => Food.fromJSON(f)),
        difficulty: data.difficulty,
        gameSpeedMs: data.gameSpeedMs,
        mode: data.mode
      };
    } catch (e) {
      console.warn('加载存档失败:', e);
      return null;
    }
  }

  hasSavedState() {
    try {
      return !!localStorage.getItem('snakeSavedState');
    } catch (e) {
      return false;
    }
  }

  clearSavedState() {
    try {
      localStorage.removeItem('snakeSavedState');
    } catch (e) {}
  }

  loadHighScore() {
    try {
      const s = localStorage.getItem('snakeHighScore');
      this.highScore = s ? parseInt(s, 10) : 0;
    } catch (e) {
      this.highScore = 0;
    }
  }

  saveHighScore(score) {
    this.highScore = Math.max(this.highScore, score);
    try {
      localStorage.setItem('snakeHighScore', String(this.highScore));
    } catch (e) {}
  }
}