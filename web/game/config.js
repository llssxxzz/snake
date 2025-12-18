// game/config.js
export const GRID_COLS = 45;
export const GRID_ROWS = 30;
export const CELL_SIZE = 25;
export const GAME_WIDTH = GRID_COLS * CELL_SIZE;
export const GAME_HEIGHT = GRID_ROWS * CELL_SIZE;

export const DIFFICULTY_CONFIG = { easy: 5, medium: 8, hard: 12 };
export const MAX_FOOD = 3;
export const MODES = ['single', 'local', 'ai'];

export const FOOD_TYPES = {
  apple:  { score: 1,  color: '#a6e3a1', icon: '🍎' },
  banana: { score: 3,  color: '#f9e2af', icon: '🍌' },
  cherry: { score: 5,  color: '#f38ba8', icon: '🍒' }
};

export const SNAKE_COLORS = {
  player0: '#89b4fa',
  player1: '#f38ba8'
};