// game/systems/GameRenderer.js
import { 
  GRID_COLS, GRID_ROWS, CELL_SIZE, 
  GAME_WIDTH, GAME_HEIGHT 
} from '../config.js';
import { SNAKE_COLORS } from '../config.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scoreEl = document.getElementById('score');
    this.highScoreEl = document.getElementById('highScore');
  }

  clear() {
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  drawGrid() {
    this.ctx.strokeStyle = '#2a2a3c';
    this.ctx.lineWidth = 0.5;
    
    for (let i = 0; i < GRID_COLS; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * CELL_SIZE, 0);
      this.ctx.lineTo(i * CELL_SIZE, GAME_HEIGHT);
      this.ctx.stroke();
    }
    for (let i = 0; i < GRID_ROWS; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * CELL_SIZE);
      this.ctx.lineTo(GAME_WIDTH, i * CELL_SIZE);
      this.ctx.stroke();
    }
    
    // 边界墙
    this.ctx.strokeStyle = '#f38ba8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  drawSnake(snake) {
    if (!snake.alive) return;
    
    for (let i = 0; i < snake.body.length; i++) {
      const seg = snake.body[i];
      const x = seg.x * CELL_SIZE;
      const y = seg.y * CELL_SIZE;

      if (i === 0) {
        this._drawSnakeHead(seg, snake.direction, snake.color);
      } else {
        this._drawSnakeBody(seg, snake.color, i);
      }
    }
  }

  _drawSnakeHead(pos, direction, color) {
    const x = pos.x * CELL_SIZE;
    const y = pos.y * CELL_SIZE;
    const headW = CELL_SIZE * 0.8;
    const headH = CELL_SIZE * 0.8;
    const headX = x + (CELL_SIZE - headW) / 2;
    const headY = y + (CELL_SIZE - headH) / 2;

    // 椭圆头
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(
      headX + headW / 2, headY + headH / 2,
      headW / 2, headH / 2, 0, 0, Math.PI * 2
    );
    this.ctx.fill();

    // 眼睛
    const eyeSize = CELL_SIZE * 0.15;
    const eyeOffsetY = -headH * 0.15;
    let eyeOffsetX = headW * 0.2;
    if (direction === 'LEFT') eyeOffsetX = -eyeOffsetX;

    // 白眼
    this.ctx.fillStyle = 'white';
    this.ctx.beginPath();
    this.ctx.arc(
      headX + headW / 2 + eyeOffsetX,
      headY + headH / 2 + eyeOffsetY,
      eyeSize, 0, Math.PI * 2
    );
    this.ctx.fill();

    // 黑瞳
    this.ctx.fillStyle = 'black';
    this.ctx.beginPath();
    this.ctx.arc(
      headX + headW / 2 + eyeOffsetX * 1.2,
      headY + headH / 2 + eyeOffsetY * 1.2,
      eyeSize * 0.5, 0, Math.PI * 2
    );
    this.ctx.fill();
  }

  _drawSnakeBody(pos, baseColor, index) {
    const x = pos.x * CELL_SIZE;
    const y = pos.y * CELL_SIZE;
    const bodySize = CELL_SIZE * 0.8;
    const offset = (CELL_SIZE - bodySize) / 2;

    this.ctx.fillStyle = this._getTailColor(baseColor, index);
    this.ctx.beginPath();
    this._roundRect(x + offset, y + offset, bodySize, bodySize, 4);
    this.ctx.fill();

    this.ctx.strokeStyle = '#1e1e2e';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  _getTailColor(baseColor, segmentIndex) {
    const palettes = {
      [SNAKE_COLORS.player0]: ['#74c7ec', '#59baf8', '#40a7e5', '#3288b8'],
      [SNAKE_COLORS.player1]: ['#f5a9b8', '#f87aa0', '#f95c85', '#e54a70']
    };
    const palette = palettes[baseColor] || palettes[SNAKE_COLORS.player0];
    return palette[Math.min(segmentIndex - 1, palette.length - 1)] || baseColor;
  }

  drawFood(food) {
    const { x, y } = food.pos;
    const size = CELL_SIZE * 0.8;

    // 光晕
    this.ctx.fillStyle = food.color + '60';
    this.ctx.beginPath();
    this.ctx.arc(
      x * CELL_SIZE + CELL_SIZE / 2,
      y * CELL_SIZE + CELL_SIZE / 2,
      size / 2 + 3, 0, Math.PI * 2
    );
    this.ctx.fill();

    // 图标
    this.ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#1e1e2e';
    this.ctx.fillText(
      food.icon,
      x * CELL_SIZE + CELL_SIZE / 2,
      y * CELL_SIZE + CELL_SIZE / 2
    );
  }

  updateScoreUI(player0Score, highScore) {
    if (this.scoreEl) this.scoreEl.textContent = String(player0Score || 0);
    if (this.highScoreEl) this.highScoreEl.textContent = String(highScore || 0);
  }

  _roundRect(x, y, w, h, r) {
    if (this.ctx.roundRect) {
      this.ctx.roundRect(x, y, w, h, r);
    } else {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x + r, y);
      this.ctx.arcTo(x + w, y, x + w, y + h, r);
      this.ctx.arcTo(x + w, y + h, x, y + h, r);
      this.ctx.arcTo(x, y + h, x, y, r);
      this.ctx.arcTo(x, y, x + w, y, r);
      this.ctx.closePath();
    }
  }

  animateScoreFlyIn(value, gridPos, color) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const px = Math.round(canvasRect.left + gridPos.x * CELL_SIZE + CELL_SIZE / 2 + window.scrollX);
    const py = Math.round(canvasRect.top + gridPos.y * CELL_SIZE + CELL_SIZE / 2 + window.scrollY);
    
    const el = document.createElement('div');
    el.textContent = '+' + value;
    Object.assign(el.style, {
      position: 'absolute', left: px + 'px', top: py + 'px',
      transform: 'translate(-50%, -50%) translateY(0px)',
      padding: '4px 8px', 
      background: color || 'rgba(255,255,255,0.95)',
      color: '#111', 
      borderRadius: '8px', 
      fontWeight: '700',
      pointerEvents: 'none', 
      zIndex: '9999',
      transition: 'transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms',
      opacity: '1'
    });
    document.body.appendChild(el);
    void el.offsetHeight;
    el.style.transform = 'translate(-50%, -50%) translateY(-40px)';
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
    }, 800);
  }
}