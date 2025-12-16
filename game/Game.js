// game/Game.js
import { 
  GRID_COLS, GRID_ROWS, CELL_SIZE,
  DIFFICULTY_CONFIG, MAX_FOOD, MODES,
  SNAKE_COLORS 
} from './config.js';
import { isEqual } from './utils.js';
import { Snake } from './entities/Snake.js';
import { Food } from './entities/Food.js';
import { GameMap } from './systems/GameMap.js';
import { GameRenderer } from './systems/GameRenderer.js';
import { GameStateManager } from './systems/GameStateManager.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.canvas.width = GRID_COLS * CELL_SIZE;
    this.canvas.height = GRID_ROWS * CELL_SIZE;
    
    this.renderer = new GameRenderer(this.canvas);
    this.stateManager = new GameStateManager();

    this.finalScoreEl = document.getElementById('finalScore');
    this.startScreen = document.getElementById('startScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.pauseMenu = document.getElementById('pauseMenu');
    this.restorePrompt = document.getElementById('restorePrompt');

    // ✅ 新增：排行榜元素引用
    this.rankListEl = document.getElementById('rankList');
    this.onlineRankListEl = document.getElementById('onlineRankList');
    this.submitBtn = document.getElementById('submitScoreBtn');

    this.snakes = [];
    this.foods = [];
    this.mode = 'single';
    this.difficulty = 'medium';
    this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG.medium;
    this.gameRunning = false;
    this.gamePaused = false;
    this.animationId = null;
    this.frameCount = 0;

    // ✅ 新增：初始化本地排行榜
    this.localLeaderboard = this.loadLocalLeaderboard();
    this.updateLocalLeaderboardUI();

    this.bindEvents();
    if (this.stateManager.hasSavedState()) {
      this.showRestorePrompt();
    }
  }

  // ✅ 新增：加载本地排行榜
  loadLocalLeaderboard() {
    try {
      const data = localStorage.getItem('snakeLeaderboard');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // ✅ 新增：保存本地排行榜
  saveLocalLeaderboard() {
    try {
      localStorage.setItem('snakeLeaderboard', JSON.stringify(this.localLeaderboard));
    } catch (e) {
      console.warn('保存本地排行榜失败');
    }
  }

  // ✅ 新增：更新本地排行榜 UI
  updateLocalLeaderboardUI() {
    if (!this.rankListEl) return;
    
    if (this.localLeaderboard.length === 0) {
      this.rankListEl.innerHTML = '<li>暂无数据</li>';
      return;
    }

    this.rankListEl.innerHTML = this.localLeaderboard
      .slice(0, 10)
      .map((entry, i) => 
        `<li><span>#${i + 1}</span> <span>${entry.score}</span></li>`
      ).join('');
  }

  resetGame() {
    const startX = Math.floor(GRID_COLS / 2);
    const startY = Math.floor(GRID_ROWS / 2);

    this.snakes = [];
    
    if (this.mode === 'single') {
      this.snakes.push(new Snake(0, startX, startY, 'RIGHT', SNAKE_COLORS.player0, false));
    } else if (this.mode === 'local') {
      const gap = 10;
      const p0x = Math.min(startX + gap, GRID_COLS - 6);
      const p1x = Math.max(startX - gap, 6);
      this.snakes.push(new Snake(0, p0x, startY, 'LEFT', SNAKE_COLORS.player0, false));
      this.snakes.push(new Snake(1, p1x, startY, 'RIGHT', SNAKE_COLORS.player1, false));
    } else if (this.mode === 'ai') {
      const p0x = Math.min(startX + 4, GRID_COLS - 6);
      const p1x = Math.max(startX - 7, 6);
      const topRow = Math.max(6, Math.floor(GRID_ROWS / 3));
      const bottomRow = Math.min(GRID_ROWS - 7, Math.floor(GRID_ROWS * 2 / 3));
      this.snakes.push(new Snake(0, p0x, topRow, 'LEFT', SNAKE_COLORS.player0, false));
      this.snakes.push(new Snake(1, p1x, bottomRow, 'RIGHT', SNAKE_COLORS.player1, true));
    }

    this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[this.difficulty];
    this.foods = [];
    for (let i = 0; i < MAX_FOOD; i++) {
      this.spawnFood();
    }

    this.renderer.updateScoreUI(this.snakes[0]?.score || 0, this.stateManager.highScore);
    this.saveGameState();
  }

  gameLoop = () => {
    if (!this.gameRunning || this.gamePaused) return;

    // AI 决策
    for (const snake of this.snakes) {
      if (snake.alive && snake.isAI) {
        this.computeAIMove(snake);
      }
    }

    const newHeads = this.snakes.map(s => s.alive ? s.simulateMove(s.nextDirection) : null);
    const willGrow = newHeads.map((nh, i) => 
      nh && this.foods.some(f => isEqual(nh, f.pos))
    );

    const finalBodies = this.snakes.map((s, i) => {
      if (!s.alive) return s.body.slice();
      const nh = newHeads[i];
      if (!nh) return s.body.slice();
      const carried = s.body.slice(0, Math.max(0, s.body.length - (willGrow[i] ? 0 : 1)));
      return [nh, ...carried];
    });

    const losers = new Set();
    const isInitialFrame = this.frameCount === 0;

    // 越界 & 头对头
    newHeads.forEach((nh, i) => {
      if (!nh || !this.snakes[i].alive) return;
      if (!GameMap.isInBounds(nh)) losers.add(i);
    });

    for (let i = 0; i < newHeads.length; i++) {
      for (let j = i + 1; j < newHeads.length; j++) {
        if (newHeads[i] && newHeads[j] && isEqual(newHeads[i], newHeads[j])) {
          losers.add(i); losers.add(j);
        }
      }
    }

    // 自撞/互撞（跳过首帧）
    if (!isInitialFrame) {
      for (let i = 0; i < newHeads.length; i++) {
        const nh = newHeads[i];
        if (!nh || !this.snakes[i].alive || losers.has(i)) continue;
        for (let j = 0; j < finalBodies.length; j++) {
          const body = finalBodies[j];
          const start = i === j ? 1 : 0;
          for (let k = start; k < body.length; k++) {
            if (isEqual(nh, body[k])) {
              losers.add(i);
              break;
            }
          }
        }
      }
    }

    // 得分
    const eatenIndices = [];
    for (let fi = this.foods.length - 1; fi >= 0; fi--) {
      const food = this.foods[fi];
      for (let si = 0; si < newHeads.length; si++) {
        if (newHeads[si] && isEqual(newHeads[si], food.pos)) {
          this.snakes[si].score += food.score;
          this.renderer.animateScoreFlyIn(food.score, food.pos, this.snakes[si].color);
          eatenIndices.push(fi);
        }
      }
    }
    if (eatenIndices.length) {
      const unique = Array.from(new Set(eatenIndices)).sort((a, b) => b - a);
      for (const idx of unique) this.foods.splice(idx, 1);
    }

    // 应用移动
    for (let i = 0; i < this.snakes.length; i++) {
      if (!this.snakes[i].alive) continue;
      if (losers.has(i)) {
        this.snakes[i].alive = false;
      } else {
        this.snakes[i].move(newHeads[i], willGrow[i]);
      }
    }

    // 补食物
    while (this.foods.length < MAX_FOOD) this.spawnFood();

    // 结束？
    if (losers.size > 0) {
      this.gameOver(Array.from(losers)[0]); // ✅ 修复：调用 gameOver（不是 gameOverFor）
    } else {
      this.render();
      this.saveGameState();
      this.frameCount++;
      this.animationId = setTimeout(this.gameLoop, this.gameSpeedMs);
    }
  }

  computeAIMove(snake) {
    if (!this.foods.length) return;
    
    let bestFood = null;
    let minDist = Infinity;
    for (const food of this.foods) {
      const dx = food.pos.x - snake.head.x;
      const dy = food.pos.y - snake.head.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < minDist) {
        minDist = dist;
        bestFood = food.pos;
      }
    }
    if (!bestFood) return;

    const validDirs = [];
    for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
      if (!snake.isValidDirection(dir)) continue;
      const newHead = snake.simulateMove(dir);
      if (!GameMap.isInBounds(newHead)) continue;
      if (GameMap.willCollideWithSnakes(newHead, this.snakes, snake.id)) continue;
      const dist = Math.abs(newHead.x - bestFood.x) + Math.abs(newHead.y - bestFood.y);
      validDirs.push({ dir, dist });
    }

    if (validDirs.length === 0) {
      for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
        if (snake.isValidDirection(dir)) {
          snake.setNextDirection(dir);
          return;
        }
      }
    } else {
      validDirs.sort((a, b) => a.dist - b.dist);
      snake.setNextDirection(validDirs[0].dir);
    }
  }

  spawnFood() {
    const pos = GameMap.generateSafeFoodPosition(this.snakes, this.foods);
    const type = Food.generateRandomType();
    this.foods.push(new Food(pos.x, pos.y, type));
  }

  render() {
    this.renderer.clear();
    this.renderer.drawGrid();
    
    for (const snake of this.snakes) {
      this.renderer.drawSnake(snake);
    }
    for (const food of this.foods) {
      this.renderer.drawFood(food);
    }

    this.renderer.updateScoreUI(this.snakes[0]?.score || 0, this.stateManager.highScore);
  }

  saveGameState() {
    const snapshot = this.stateManager.createStateSnapshot(
      this.snakes, this.foods, this.difficulty, this.gameSpeedMs, this.mode
    );
    this.stateManager.saveGameState(snapshot);
  }

  // ✅ 已修复：单人模式显示"你的最终得分"
  gameOver(loserId) {
    const loser = this.snakes.find(s => s.id === loserId);
    if (loser) loser.alive = false;

    const alive = this.snakes.filter(s => s.alive);
    let text = '';

    if (this.mode === 'single') {
      const playerScore = this.snakes[0]?.score || 0;
      text = `你的最终得分: ${playerScore}`;
    } else {
      if (alive.length === 1) {
        text = `玩家 ${alive[0].id + 1} 获胜！ 得分 ${alive[0].score}`;
      } else if (alive.length === 0) {
        text = '平局 / 双方都失败';
      } else {
        text = '对局结束';
      }
    }

    // 更新高分 & 本地排行榜
    const finalScore = Math.max(...this.snakes.map(s => s.score));
    for (const s of this.snakes) {
      this.stateManager.saveHighScore(s.score);
    }

    // ✅ 新增：更新本地排行榜
    this.localLeaderboard.push({
      score: finalScore,
      timestamp: Date.now(),
      mode: this.mode
    });

    // 排序：分数降序，同分按时间升序
    this.localLeaderboard.sort((a, b) => 
      b.score - a.score || a.timestamp - b.timestamp
    );
    this.localLeaderboard = this.localLeaderboard.slice(0, 10);
    this.saveLocalLeaderboard();
    this.updateLocalLeaderboardUI();

    // ✅ 启用提交按钮（预留后端对接点 1/3）
    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = `提交 ${finalScore} 分`;
    }

    if (this.finalScoreEl) this.finalScoreEl.textContent = text;
    if (this.gameOverScreen) this.gameOverScreen.classList.add('active');

    this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    this.stateManager.clearSavedState();
  }

  bindEvents() {
    // 阻止 Shift+Enter 等默认行为
    ['keydown', 'keyup'].forEach(type => {
      window.addEventListener(type, (e) => {
        if (e.key === 'Shift') {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    });

    window.addEventListener('keydown', (e) => {
      if (this.restorePrompt?.classList.contains('active')) return;
      const key = e.key.toLowerCase();
      
      if (key === ' ' || key === 'p') {
        if (this.gameRunning) this.togglePause();
        e.preventDefault();
        return;
      }
      if (key === 'e' && this.gameRunning) {
        this.endFromPause();
        return;
      }
      if (!this.gameRunning || this.gamePaused) return;

      const p0 = this.snakes.find(s => s.id === 0);
      if (p0?.alive) {
        if (key === 'arrowup') p0.setNextDirection('UP');
        else if (key === 'arrowdown') p0.setNextDirection('DOWN');
        else if (key === 'arrowleft') p0.setNextDirection('LEFT');
        else if (key === 'arrowright') p0.setNextDirection('RIGHT');
        else if (this.mode === 'single') {
          if (key === 'w') p0.setNextDirection('UP');
          else if (key === 's') p0.setNextDirection('DOWN');
          else if (key === 'a') p0.setNextDirection('LEFT');
          else if (key === 'd') p0.setNextDirection('RIGHT');
        }
      }

      const p1 = this.snakes.find(s => s.id === 1);
      if (p1?.alive && this.mode !== 'single') {
        if (key === 'w') p1.setNextDirection('UP');
        else if (key === 's') p1.setNextDirection('DOWN');
        else if (key === 'a') p1.setNextDirection('LEFT');
        else if (key === 'd') p1.setNextDirection('RIGHT');
      }
    });

    document.getElementById('startBtn')?.addEventListener('click', () => this.startGame());
    document.getElementById('restartBtn')?.addEventListener('click', () => this.startGame());
    document.getElementById('menuBtn')?.addEventListener('click', () => this.returnToMenu());

    // ✅ 新增：绑定提交按钮
    this.submitBtn?.addEventListener('click', () => this.submitScore());

    document.querySelectorAll('input[name="difficulty"]').forEach(r => {
      r.addEventListener('change', (e) => {
        this.difficulty = e.target.value;
        this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[this.difficulty];
      });
    });
    document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (MODES.includes(e.target.value)) this.mode = e.target.value;
      });
    });

    document.getElementById('pauseContinueBtn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('pauseEndBtn')?.addEventListener('click', () => this.endFromPause());
    document.getElementById('restoreBtn')?.addEventListener('click', () => this.restoreSavedState());
    document.getElementById('newGameBtn')?.addEventListener('click', () => {
      this.stateManager.clearSavedState();
      this.startGame();
    });
  }

  startGame() {
    [this.startScreen, this.gameOverScreen, this.pauseMenu, this.restorePrompt]
      .forEach(el => el?.classList.remove('active'));
    
    // ✅ 重置提交按钮状态
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = '提交分数';
    }

    this.stateManager.clearSavedState();
    this.resetGame();
    this.gameRunning = true;
    this.gamePaused = false;
    this.frameCount = 0;
    this.gameLoop();
  }

  // ✅ 新增：提交分数到后端（预留后端对接点 2/3）
  async submitScore() {
    if (this.submitBtn.disabled) return;
    
    const finalScore = Math.max(...this.snakes.map(s => s.score));
    
    try {
      // 🔥🔥🔥 这里是后端接口调用点！🔥🔥🔥
      // URL: /api/leaderboard (POST)
      // 请求体: { score, mode, timestamp }
      // 你只需提供后端服务，前端无需修改
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // 'Authorization': 'Bearer xxx' // 如需鉴权可加
        },
        body: JSON.stringify({
          score: finalScore,
          mode: this.mode,
          timestamp: Date.now()
          // replayId: this.generateReplayId() // 未来回放用
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`🏆 提交成功！当前排名第 ${data.rank}`);
        this.loadOnlineLeaderboard(); // 刷新在线榜
      } else {
        throw new Error(data.message || '提交失败');
      }
    } catch (e) {
      alert('❌ 提交失败，请检查网络');
      console.error('提交分数失败:', e);
    }
  }

  // ✅ 新增：加载在线排行榜（预留后端对接点 3/3）
  async loadOnlineLeaderboard() {
    try {
      // 🔥🔥🔥 这里是后端接口调用点！🔥🔥🔥
      // URL: /api/leaderboard (GET)
      // 响应: { ranks: [{ score, mode, timestamp }] }
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      
      if (data.ranks && data.ranks.length) {
        document.getElementById('onlineLeaderboard').style.display = 'block';
        this.onlineRankListEl.innerHTML = data.ranks
          .slice(0, 10)
          .map((r, i) => 
            `<li><span>#${i+1}</span> <span>${r.score}</span> <small>[${r.mode}]</small></li>`
          ).join('');
      }
    } catch (e) {
      console.warn('加载在线榜失败:', e);
    }
  }

  restoreSavedState() {
    const state = this.stateManager.loadSavedState();
    if (!state) return;

    this.snakes = state.snakes;
    this.foods = state.foods;
    this.difficulty = state.difficulty;
    this.gameSpeedMs = state.gameSpeedMs;
    this.mode = state.mode;

    this.hideRestorePrompt();
    this.gameRunning = true;
    this.gamePaused = false;
    this.frameCount = 0;
    this.gameLoop();
  }

  togglePause() {
    if (!this.gameRunning) return;
    this.gamePaused = !this.gamePaused;
    if (this.gamePaused) {
      this.showPauseMenu();
      this.saveGameState();
    } else {
      this.hidePauseMenu();
      this.gameLoop();
    }
  }

  endFromPause() {
    this.hidePauseMenu();
    this.gamePaused = false;
    this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    
    const alive = this.snakes.filter(s => s.alive);
    let text = '游戏结束';
    if (alive.length === 1) text = `玩家 ${alive[0].id + 1} 获胜！ 得分 ${alive[0].score}`;
    else if (alive.length === 0) text = '平局 / 无存活玩家';
    
    if (this.finalScoreEl) this.finalScoreEl.textContent = text;
    if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
    this.stateManager.clearSavedState();
  }

  returnToMenu() {
    this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    [this.gameOverScreen, this.pauseMenu].forEach(el => el?.classList.remove('active'));
    this.startScreen?.classList.add('active');
  }

  showRestorePrompt() {
    if (!this.restorePrompt) return;
    this.restorePrompt.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2000;
    `;
    this.restorePrompt.classList.add('active');
    this.canvas.parentElement.appendChild(this.restorePrompt);
  }

  hideRestorePrompt() {
    this.restorePrompt?.classList.remove('active');
  }

  showPauseMenu() {
    this.pauseMenu?.classList.add('active');
  }

  hidePauseMenu() {
    this.pauseMenu?.classList.remove('active');
  }
}