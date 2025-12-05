// ===== 类型定义 =====
type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Food {
  pos: Point;
  type: 'normal' | 'gold';
  score: number;
}

// ===== 配置 =====
const GRID_COLS = 45;   // 列数（宽）
const GRID_ROWS = 30;   // 行数（高）
const CELL_SIZE = 25;   // 每格像素
const GAME_WIDTH = GRID_COLS * CELL_SIZE;   // 1125
const GAME_HEIGHT = GRID_ROWS * CELL_SIZE;  // 750

const DIFFICULTY_CONFIG = {
  'easy': 5,     // 每秒 5 格 → 200ms/格
  'medium': 8,   // 每秒 8 格 → 125ms/格
  'hard': 12     // 每秒 12 格 → 83ms/格
};

// ===== 对象池优化 =====
class SpritePool {
  private pool: { x: number; y: number; w: number; h: number; color: string }[] = [];
  
  get(x: number, y: number, w: number, h: number, color: string) {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      Object.assign(obj, { x, y, w, h, color });
      return obj;
    }
    return { x, y, w, h, color };
  }

  release(obj: { x: number; y: number; w: number; h: number; color: string }) {
    this.pool.push(obj);
  }
}

const spritePool = new SpritePool();

// ===== 游戏主类 =====
class SnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private snake: Point[] = [];
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private food: Food | null = null;
  private score = 0;
  private highScore = 0;
  private gameSpeedMs = 1000 / DIFFICULTY_CONFIG.medium; // 默认中等
  private difficulty: keyof typeof DIFFICULTY_CONFIG = 'medium';
  private gameRunning = false;
  private gamePaused = false;
  private animationId: number | null = null;

  // DOM 元素（readonly 确保不被意外修改）
  private readonly scoreEl: HTMLElement;
  private readonly highScoreEl: HTMLElement;
  private readonly finalScoreEl: HTMLElement;
  private readonly startScreen: HTMLElement;
  private readonly gameOverScreen: HTMLElement;
  private readonly pauseTip: HTMLElement;

  constructor() {
    // 初始化 Canvas
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.canvas.width = GAME_WIDTH;
    this.canvas.height = GAME_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;

    // 绑定 UI 元素
    this.scoreEl = document.getElementById('score')!;
    this.highScoreEl = document.getElementById('highScore')!;
    this.finalScoreEl = document.getElementById('finalScore')!;
    this.startScreen = document.getElementById('startScreen')!;
    this.gameOverScreen = document.getElementById('gameOverScreen')!;
    this.pauseTip = document.getElementById('pauseTip')!;

    this.loadHighScore();
    this.bindEvents();
  }

  private bindEvents() {
    // 键盘控制
    window.addEventListener('keydown', (e) => {
      if (!this.gameRunning) return;
      if (e.key === ' ') {
        this.togglePause();
        e.preventDefault();
        return;
      }

      let dir: Direction | null = null;
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') dir = 'UP';
      else if (key === 'arrowdown' || key === 's') dir = 'DOWN';
      else if (key === 'arrowleft' || key === 'a') dir = 'LEFT';
      else if (key === 'arrowright' || key === 'd') dir = 'RIGHT';

      if (dir && this.isValidDirection(dir)) {
        this.nextDirection = dir;
      }
    });

    // UI 按钮
    (document.getElementById('startBtn') as HTMLElement).addEventListener('click', () => this.startGame());
    (document.getElementById('restartBtn') as HTMLElement).addEventListener('click', () => this.startGame());
    (document.getElementById('menuBtn') as HTMLElement).addEventListener('click', () => {
      this.gameRunning = false;
      if (this.animationId) clearTimeout(this.animationId);
      this.gameOverScreen.classList.remove('active');
      this.startScreen.classList.add('active');
    });

    // 难度选择
    document.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const value = radio.value as keyof typeof DIFFICULTY_CONFIG;
        this.difficulty = value;
        this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[value];
      });
    });
  }

  private isValidDirection(dir: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN', 'DOWN': 'UP',
      'LEFT': 'RIGHT', 'RIGHT': 'LEFT'
    };
    return dir !== opposites[this.direction];
  }

  private startGame() {
    this.resetGame();
    this.gameRunning = true;
    this.gamePaused = false;
    this.startScreen.classList.remove('active');
    this.gameOverScreen.classList.remove('active');
    this.gameLoop();
  }

  private resetGame() {
    // 蛇初始位置：居中
    const startX = Math.floor(GRID_COLS / 2);
    const startY = Math.floor(GRID_ROWS / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.score = 0;
    this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[this.difficulty];
    this.spawnFood();
    this.updateScoreUI();
  }

  private gameLoop = () => {
    if (!this.gameRunning || this.gamePaused) return;

    this.direction = this.nextDirection;
    this.moveSnake();
    this.checkCollisions();
    this.render();

    this.animationId = setTimeout(this.gameLoop, this.gameSpeedMs);
  };

  private moveSnake() {
    const head = { ...this.snake[0] };
    switch (this.direction) {
      case 'UP': head.y--; break;
      case 'DOWN': head.y++; break;
      case 'LEFT': head.x--; break;
      case 'RIGHT': head.x++; break;
    }

    this.snake.unshift(head);

    if (this.food && this.isEqual(head, this.food.pos)) {
      // 快照：分值与被吃位置（网格坐标）
      const eatenScore = this.food.score;
      const eatenPos = { ...this.food.pos };
      this.score += eatenScore;
      this.updateScoreUI();

      // 调用动画时只使用快照，避免 animate 访问到已更新的 this.food
      console.log('EAT:', { eatenScore, eatenPos }); // 调试用，可删除
      this.animateScoreFlyIn(eatenScore, eatenPos);

      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  private isEqual(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private spawnFood() {
    let pos: Point;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_COLS),
        y: Math.floor(Math.random() * GRID_ROWS)
      };
    } while (this.snake.some(seg => this.isEqual(seg, pos)));

    const type = Math.random() < 0.9 ? 'normal' : 'gold';
    const score = type === 'normal' ? 1 : 5;
    this.food = { pos, type, score };
  }

  private checkCollisions() {
    const head = this.snake[0];
    // 边界检测：x∈[0, GRID_COLS), y∈[0, GRID_ROWS)
    if (head.x < 0 || head.x >= GRID_COLS || head.y < 0 || head.y >= GRID_ROWS) {
      this.gameOver();
      return;
    }
    // 自撞检测
    for (let i = 1; i < this.snake.length; i++) {
      if (this.isEqual(head, this.snake[i])) {
        this.gameOver();
        return;
      }
    }
  }

  private gameOver() {
    this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    
    this.highScore = Math.max(this.highScore, this.score);
    this.saveHighScore();
    
    this.finalScoreEl.textContent = this.score.toString();
    this.gameOverScreen.classList.add('active');
  }

  private togglePause() {
    this.gamePaused = !this.gamePaused;
    this.pauseTip.classList.toggle('show', this.gamePaused);
    if (!this.gamePaused && this.gameRunning) {
      this.gameLoop();
    }
  }

  private render() {
    // 清屏
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 绘制网格线
    this.ctx.strokeStyle = '#2a2a3c';
    this.ctx.lineWidth = 0.5;

    // 垂直线
    for (let i = 0; i <= GRID_COLS; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * CELL_SIZE, 0);
      this.ctx.lineTo(i * CELL_SIZE, GAME_HEIGHT);
      this.ctx.stroke();
    }

    // 水平线
    for (let i = 0; i <= GRID_ROWS; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * CELL_SIZE);
      this.ctx.lineTo(GAME_WIDTH, i * CELL_SIZE);
      this.ctx.stroke();
    }

    // 绘制蛇
    this.snake.forEach((seg, i) => {
      const size = i === 0 ? CELL_SIZE - 2 : CELL_SIZE - 4;
      const offset = (CELL_SIZE - size) / 2;
      const color = i === 0 ? '#89b4fa' : '#74c7ec';

      const rect = spritePool.get(
        seg.x * CELL_SIZE + offset,
        seg.y * CELL_SIZE + offset,
        size,
        size,
        color
      );
      this.ctx.fillStyle = rect.color;
      this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      this.ctx.strokeStyle = '#1e1e2e';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      spritePool.release(rect);
    });

    // 绘制食物
    if (this.food) {
      const { x, y } = this.food.pos;
      const color = this.food.type === 'gold' ? '#f9e2af' : '#a6e3a1';
      const rect = spritePool.get(
        x * CELL_SIZE + 2,
        y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
        color
      );
      this.ctx.fillStyle = rect.color;
      this.ctx.beginPath();
      this.ctx.arc(
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        rect.w / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      spritePool.release(rect);
    }
  }

  private animateScoreFlyIn(value: number, gridPos: Point) {
    // 把格子坐标转换为页面像素（相对于页面）
    const canvasRect = this.canvas.getBoundingClientRect();
    const px = Math.round(canvasRect.left + gridPos.x * CELL_SIZE + CELL_SIZE / 2 + window.scrollX);
    const py = Math.round(canvasRect.top + gridPos.y * CELL_SIZE + CELL_SIZE / 2 + window.scrollY);

    const el = document.createElement('div');
    el.textContent = `+${value}`;
    Object.assign(el.style, {
      position: 'absolute',
      left: px + 'px',
      top: py + 'px',
      transform: 'translate(-50%, -50%) translateY(0px)',
      padding: '4px 8px',
      background: 'rgba(255,255,255,0.95)',
      color: '#111',
      borderRadius: '8px',
      fontWeight: '700',
      pointerEvents: 'none',
      zIndex: '9999',
      transition: 'transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms',
      opacity: '1'
    });

    document.body.appendChild(el);
    // 强制回流以确保 transition 生效
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    el.style.transform = 'translate(-50%, -50%) translateY(-40px)';
    el.style.opacity = '0';

    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
    }, 800);
  }

  private updateScoreUI() {
    this.scoreEl.textContent = this.score.toString();
    this.highScoreEl.textContent = this.highScore.toString();
  }

  private loadHighScore() {
    const saved = localStorage.getItem('snakeHighScore');
    this.highScore = saved ? parseInt(saved, 10) : 0;
    this.updateScoreUI();
  }

  private saveHighScore() {
    localStorage.setItem('snakeHighScore', this.highScore.toString());
    this.updateScoreUI();
  }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
  new SnakeGame();
});