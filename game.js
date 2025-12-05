// ===== 配置 =====
const GRID_COLS = 45;
const GRID_ROWS = 30;
const CELL_SIZE = 25;
const GAME_WIDTH = GRID_COLS * CELL_SIZE;
const GAME_HEIGHT = GRID_ROWS * CELL_SIZE;

const DIFFICULTY_CONFIG = { easy: 5, medium: 8, hard: 12 };
const MAX_FOOD = 3;
const MODES = ['single', 'local', 'ai'];

const FOOD_TYPES = {
  apple: { score: 1, color: '#a6e3a1', icon: '🍎' },
  banana: { score: 3, color: '#f9e2af', icon: '🍌' },
  cherry: { score: 5, color: '#f38ba8', icon: '🍒' }
};

class SpritePool {
  constructor() { this.pool = []; }
  get(x, y, w, h, color) {
    if (this.pool.length) {
      const o = this.pool.pop();
      o.x = x; o.y = y; o.w = w; o.h = h; o.color = color;
      return o;
    }
    return { x, y, w, h, color };
  }
  release(obj) { this.pool.push(obj); }
}
const spritePool = new SpritePool();

class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.canvas.width = GAME_WIDTH; this.canvas.height = GAME_HEIGHT;
    this.ctx = this.canvas.getContext('2d');

    this.snakes = [];
    this.mode = 'single';
    this.score = 0;
    this.highScore = 0;
    this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG.medium;
    this.difficulty = 'medium';
    this.gameRunning = false;
    this.gamePaused = false;
    this.animationId = null;
    this.frameCount = 0; // 新增：帧计数器

    this.scoreEl = document.getElementById('score');
    this.highScoreEl = document.getElementById('highScore');
    this.finalScoreEl = document.getElementById('finalScore');
    this.startScreen = document.getElementById('startScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.pauseTip = document.getElementById('pauseTip');
    this.pauseMenu = document.getElementById('pauseMenu');
    this.restorePrompt = document.getElementById('restorePrompt');

    this.foods = [];

    this.loadHighScore();
    this.bindEvents();

    if (this.hasSavedState()) this.showRestorePrompt();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.restorePrompt && this.restorePrompt.classList.contains('active')) return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'p') { if (!this.gameRunning) return; this.togglePause(); e.preventDefault(); return; }
      if (key === 'e') { if (this.gameRunning) this.endFromPause(); return; }
      if (!this.gameRunning || this.gamePaused) return;

      // player0 常用控制：箭头键（始终）; 若为单人模式，WASD 也控制 player0
      const p0 = this.snakes[0];
      if (p0 && p0.alive) {
        if (key === 'arrowup') this.trySetDir(0, 'UP');
        else if (key === 'arrowdown') this.trySetDir(0, 'DOWN');
        else if (key === 'arrowleft') this.trySetDir(0, 'LEFT');
        else if (key === 'arrowright') this.trySetDir(0, 'RIGHT');
        // 同时兼容 WASD 到 player0（单人模式或习惯双控）
        if (this.mode === 'single') {
          if (key === 'w') this.trySetDir(0, 'UP');
          else if (key === 's') this.trySetDir(0, 'DOWN');
          else if (key === 'a') this.trySetDir(0, 'LEFT');
          else if (key === 'd') this.trySetDir(0, 'RIGHT');
        }
      }

      // player1 使用 WASD（本地对战或 AI 模式 player1 可为人或 AI）
      const p1 = this.snakes[1];
      if (p1 && p1.alive) {
        if (key === 'w') this.trySetDir(1, 'UP');
        else if (key === 's') this.trySetDir(1, 'DOWN');
        else if (key === 'a') this.trySetDir(1, 'LEFT');
        else if (key === 'd') this.trySetDir(1, 'RIGHT');
      }
    });

    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) restartBtn.addEventListener('click', () => this.startGame());
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', () => this.returnToMenu());

    document.querySelectorAll('input[name="difficulty"]').forEach(r => {
      r.addEventListener('change', (e) => {
        const v = e.target.value; this.difficulty = v; this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[v];
      });
    });

    document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', (e) => {
        const v = e.target.value; if (MODES.includes(v)) this.mode = v;
      });
    });

    const contBtn = document.getElementById('pauseContinueBtn');
    const endBtn = document.getElementById('pauseEndBtn');
    if (contBtn) contBtn.addEventListener('click', () => this.togglePause());
    if (endBtn) endBtn.addEventListener('click', () => this.endFromPause());

    const restoreBtn = document.getElementById('restoreBtn');
    const newBtn = document.getElementById('newGameBtn');
    if (restoreBtn) restoreBtn.addEventListener('click', () => this.restoreSavedState());
    if (newBtn) newBtn.addEventListener('click', () => { this.clearSavedState(); this.startGame(); });
  }

  isValidDirFor(snakeIdx, dir) {
    const snake = this.snakes[snakeIdx]; if (!snake) return false;
    const opposites = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    return dir !== opposites[snake.direction] && dir !== snake.direction; // 防止重复设置相同方向
  }

  trySetDir(snakeIdx, dir) {
    if (this.isValidDirFor(snakeIdx, dir)) {
      this.snakes[snakeIdx].nextDirection = dir;
      return true;
    }
    return false;
  }

  resetGame() {
    const startX = Math.floor(GRID_COLS / 2);
    const startY = Math.floor(GRID_ROWS / 2);

    this.snakes = [];
    const makeSnake = (id, x, y, dir, color, isAI = false) => ({
      id,
      body: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }],
      direction: dir,
      nextDirection: dir,
      score: 0,
      alive: true,
      isAI,
      color
    });

    if (this.mode === 'single') {
      // 单人：居中
      this.snakes.push(makeSnake(0, startX, startY, 'RIGHT', '#89b4fa', false));
    } else if (this.mode === 'local') {
      // 本地双人：放在同一行但左右分开，保证间距足够（至少 10 格）
      const gap = 10; // ✅ 修复：增大初始间距
      const p0x = Math.min(startX + gap, GRID_COLS - 6);
      const p1x = Math.max(startX - gap, 6);
      this.snakes.push(makeSnake(0, p0x, startY, 'LEFT', '#89b4fa', false));
      this.snakes.push(makeSnake(1, p1x, startY, 'RIGHT', '#f38ba8', false));
    } else if (this.mode === 'ai') {
      // 人机：放在不同行，减少一开始互相干扰
      const p0x = Math.min(startX + 4, GRID_COLS - 6);
      const p1x = Math.max(startX - 7, 6);
      const topRow = Math.max(6, Math.floor(GRID_ROWS / 3));
      const bottomRow = Math.min(GRID_ROWS - 7, Math.floor(GRID_ROWS * 2 / 3));
      this.snakes.push(makeSnake(0, p0x, topRow, 'LEFT', '#89b4fa', false));
      this.snakes.push(makeSnake(1, p1x, bottomRow, 'RIGHT', '#f38ba8', true));
    }

    this.gameSpeedMs = 1000 / DIFFICULTY_CONFIG[this.difficulty];
    this.foods = [];
    for (let i = 0; i < MAX_FOOD; i++) this.spawnFood();

    this.updateScoreUI();
    this.saveGameState();
  }

  // ✅ 修复：关键！添加第一帧保护逻辑
  gameLoop = () => {
    if (!this.gameRunning || this.gamePaused) return;

    // 1) AI 决策：先计算 AI 的 nextDirection（基于当前信息）
    for (let i = 0; i < this.snakes.length; i++) {
      if (!this.snakes[i].alive) continue;
      if (this.snakes[i].isAI) this.computeAIMove(i);
    }

    // 2) 计算每条蛇的新头（基于 nextDirection）
    const newHeads = this.snakes.map((s) => {
      if (!s.alive) return null;
      return this.simulateMoveDir(s.body[0], s.nextDirection);
    });

    // 3) 预判哪些蛇将吃到食物（用于决定是否成长，从而影响尾部是否会被移除）
    const willGrow = newHeads.map((nh) => {
      if (!nh) return false;
      return this.foods.some(f => this.isEqual(nh, f.pos));
    });

    // 4) 构造每条蛇的"最终身体"（移动后会存在的格子）
    const finalBodies = this.snakes.map((s, idx) => {
      if (!s.alive) return s.body.slice();
      const nh = newHeads[idx];
      if (!nh) return s.body.slice();
      const carried = s.body.slice(0, Math.max(0, s.body.length - (willGrow[idx] ? 0 : 1)));
      return [nh, ...carried];
    });

    // ✅ 修复：第一帧跳过碰撞检测（防初始假阳性）
    const isInitialFrame = (this.frameCount === 0);
    
    // 5) 检查越界和头对头等直接失败情况
    const losers = new Set();
    
    // 越界检测（第一帧不禁用）
    newHeads.forEach((nh, idx) => {
      if (!nh || !this.snakes[idx].alive) return;
      if (nh.x < 0 || nh.x >= GRID_COLS || nh.y < 0 || nh.y >= GRID_ROWS) losers.add(idx);
    });
    
    // 头对头碰撞（第一帧不禁用，因为可能真的在同一点）
    for (let i = 0; i < newHeads.length; i++) {
      const a = newHeads[i];
      if (!a || !this.snakes[i].alive) continue;
      for (let j = i + 1; j < newHeads.length; j++) {
        const b = newHeads[j];
        if (!b || !this.snakes[j].alive) continue;
        if (this.isEqual(a, b)) { losers.add(i); losers.add(j); }
      }
    }

    // 6) 检查新头是否撞到任意蛇的"最终身体"（自撞或撞到他人）- 第一帧跳过
    if (!isInitialFrame) {
      for (let i = 0; i < newHeads.length; i++) {
        const nh = newHeads[i];
        if (!nh || !this.snakes[i].alive || losers.has(i)) continue;
        for (let j = 0; j < finalBodies.length; j++) {
          const body = finalBodies[j];
          const startIndex = (i === j) ? 1 : 0; // 对自己跳过头（index 0）
          for (let k = startIndex; k < body.length; k++) {
            if (this.isEqual(nh, body[k])) {
              console.log(`蛇 ${i} 撞到了 ${j} 的身体部分 ${k}`);
              losers.add(i); 
              break;
            }
          }
          if (losers.has(i)) break;
        }
      }
    }

    // 7) 处理得分（先统计所有被吃的 food，允许多蛇同时吃不同 food）
    const eatenFoods = [];
    for (let fi = this.foods.length - 1; fi >= 0; fi--) {
      const f = this.foods[fi];
      // 哪些蛇的新头碰到了该食物
      for (let si = 0; si < newHeads.length; si++) {
        if (!newHeads[si] || !this.snakes[si].alive) continue;
        if (this.isEqual(newHeads[si], f.pos)) {
          // 记录得分并动画（使用快照位置）
          this.snakes[si].score += f.score;
          this.animateScoreFlyInForPlayer(f.score, f.pos, this.snakes[si].color);
          eatenFoods.push(fi);
        }
      }
    }
    // 从 foods 中移除已吃项（由后向前删除索引稳定）
    if (eatenFoods.length) {
      const uniqueIdx = Array.from(new Set(eatenFoods)).sort((a,b)=>b-a);
      for (const idx of uniqueIdx) this.foods.splice(idx, 1);
    }

    // 8) 将最终身体应用到 snakes（若某蛇被判输，不再更新其身体）
    for (let i = 0; i < this.snakes.length; i++) {
      if (!this.snakes[i].alive) continue;
      if (losers.has(i)) {
        // 直接标为死亡（不替换身体）
        this.snakes[i].alive = false;
      } else {
        this.snakes[i].body = finalBodies[i];
        // 更新方向为 nextDirection（已经用于 newHead）
        this.snakes[i].direction = this.snakes[i].nextDirection;
      }
    }

    // 9) 补充被吃掉的食物，保持数量
    while (this.foods.length < MAX_FOOD) this.spawnFood();

    // 10) 若有失败者，结束对局（按你的规则：碰到对方/自己/墙就输了）
    if (losers.size > 0) {
      // 若有多个失败者，触发第一个以调用 gameOverFor（该函数会结束对局并显示结果）
      const firstLoser = Array.from(losers)[0];
      this.gameOverFor(firstLoser);
    } else {
      // 继续游戏
      this.render();
      this.saveGameState();
      this.frameCount++; // ✅ 修复：增加帧计数
      this.animationId = setTimeout(this.gameLoop, this.gameSpeedMs);
    }
  };

  computeAIMove(idx) {
    const s = this.snakes[idx]; if (!s || !s.alive) return;
    if (!this.foods.length) return;
    
    // 优先靠近最近的食物
    let bestFood = null;
    let minDist = Infinity;
    for (const f of this.foods) {
      const dx = f.pos.x - s.body[0].x;
      const dy = f.pos.y - s.body[0].y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < minDist) {
        minDist = dist;
        bestFood = f.pos;
      }
    }
    
    if (!bestFood) return;
    
    // 生成合法移动方向
    const validDirs = [];
    for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
      if (!this.isValidDirFor(idx, dir)) continue;
      
      const newHead = this.simulateMoveDir(s.body[0], dir);
      // 边界检查
      if (newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS) continue;
      // 碰撞检查
      if (this.willCollideAnySnake(newHead, idx)) continue;
      
      validDirs.push({
        dir,
        head: newHead,
        dist: Math.abs(newHead.x - bestFood.x) + Math.abs(newHead.y - bestFood.y)
      });
    }
    
    if (validDirs.length === 0) {
      // 没有安全移动，尝试任何合法移动
      for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
        if (this.isValidDirFor(idx, dir)) {
          s.nextDirection = dir;
          return;
        }
      }
      return;
    }
    
    // 选择距离食物最近的方向
    validDirs.sort((a, b) => a.dist - b.dist);
    s.nextDirection = validDirs[0].dir;
  }

  // ✅ 修复：添加 skipSnakeIdx 参数，避免检查自己的身体
  willCollideAnySnake(pos, skipSnakeIdx = null) {
    for (let i = 0; i < this.snakes.length; i++) {
      if (i === skipSnakeIdx) continue; // 跳过自己的蛇
      const s = this.snakes[i];
      if (!s.alive) continue;
      for (const seg of s.body) {
        if (seg.x === pos.x && seg.y === pos.y) return true;
      }
    }
    return false;
  }

  simulateMoveDir(point, dir) {
    const out = { x: point.x, y: point.y };
    if (dir === 'UP') out.y--;
    if (dir === 'DOWN') out.y++;
    if (dir === 'LEFT') out.x--;
    if (dir === 'RIGHT') out.x++;
    return out;
  }

  gameOverFor(loserIdx) {
    this.snakes[loserIdx].alive = false;
    const alive = this.snakes.filter(s => s.alive);
    let winnerText = '对局结束';
    if (alive.length === 1) winnerText = `玩家 ${alive[0].id + 1} 获胜！ 得分 ${alive[0].score}`;
    else if (alive.length === 0) winnerText = '平局 / 双方都失败';
    for (const s of this.snakes) this.highScore = Math.max(this.highScore, s.score);
    this.saveHighScore();
    if (this.finalScoreEl) this.finalScoreEl.textContent = winnerText;
    if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
    this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    this.clearSavedState();
  }

  animateScoreFlyInForPlayer(value, gridPos, color) {
    const canvasRect = this.canvas.getBoundingClientRect();
    const px = Math.round(canvasRect.left + gridPos.x * CELL_SIZE + CELL_SIZE / 2 + window.scrollX);
    const py = Math.round(canvasRect.top + gridPos.y * CELL_SIZE + CELL_SIZE / 2 + window.scrollY);
    const el = document.createElement('div');
    el.textContent = '+' + value;
    Object.assign(el.style, {
      position: 'absolute', left: px + 'px', top: py + 'px',
      transform: 'translate(-50%, -50%) translateY(0px)',
      padding: '4px 8px', background: color || 'rgba(255,255,255,0.95)',
      color: '#111', borderRadius: '8px', fontWeight: '700',
      pointerEvents: 'none', zIndex: '9999',
      transition: 'transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms',
      opacity: '1'
    });
    document.body.appendChild(el);
    void el.offsetHeight;
    el.style.transform = 'translate(-50%, -50%) translateY(-40px)';
    el.style.opacity = '0';
    setTimeout(() => { if (el.parentElement) el.parentElement.removeChild(el); }, 800);
  }

  render() {
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.strokeStyle = '#2a2a3c'; this.ctx.lineWidth = 0.5;
    
    // ✅ 修复：正确的边界线绘制（到 GRID_ROWS/GRID_COLS-1）
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
    
    // ✅ 修复：绘制边界墙
    this.ctx.strokeStyle = '#f38ba8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 绘制蛇
    for (const s of this.snakes) {
      if (!s.alive) continue;
      
      for (let i = 0; i < s.body.length; i++) {
        const seg = s.body[i]; const x = seg.x * CELL_SIZE; const y = seg.y * CELL_SIZE;
        if (i === 0) {
          // 蛇头
          const headW = CELL_SIZE * 0.8; const headH = CELL_SIZE * 0.8; 
          const headX = x + (CELL_SIZE - headW) / 2; const headY = y + (CELL_SIZE - headH) / 2;
          
          // 蛇头椭圆
          this.ctx.fillStyle = s.color; 
          this.ctx.beginPath();
          this.ctx.ellipse(headX + headW / 2, headY + headH / 2, headW / 2, headH / 2, 0, 0, Math.PI * 2);
          this.ctx.fill();
          
          // 蛇眼睛
          const eyeSize = CELL_SIZE * 0.15;
          const eyeOffsetY = -headH * 0.15;
          let eyeOffsetX = headW * 0.2;
          
          // 根据方向调整眼睛
          if (s.direction === 'LEFT') eyeOffsetX = -eyeOffsetX;
          
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
        } else {
          // 蛇身
          const bodySize = CELL_SIZE * 0.8; const offset = (CELL_SIZE - bodySize) / 2;
          this.ctx.fillStyle = i === 1 ? s.color : this.getTailColor(s.color, i);
          this.ctx.beginPath();
          this.ctx.roundRect(x + offset, y + offset, bodySize, bodySize, 4);
          this.ctx.fill();
          
          // 描边
          this.ctx.strokeStyle = '#1e1e2e';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }

    // 绘制食物
    for (const food of this.foods) {
      if (!food) continue;
      const { x, y } = food.pos; const size = CELL_SIZE * 0.8;
      // 食物底色光晕
      this.ctx.fillStyle = food.color + '60'; 
      this.ctx.beginPath();
      this.ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, size / 2 + 3, 0, Math.PI * 2); 
      this.ctx.fill();
      // 食物图标
      this.ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      this.ctx.textAlign = 'center'; 
      this.ctx.textBaseline = 'middle'; 
      this.ctx.fillStyle = '#1e1e2e';
      this.ctx.fillText(food.icon, x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
    }

    // 更新UI
    if (this.snakes[0]) this.scoreEl.textContent = String(this.snakes[0].score);
    if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
  }
  
  // 辅助函数：获取蛇尾渐变颜色
  getTailColor(baseColor, segmentIndex) {
    const colors = {
      '#89b4fa': ['#74c7ec', '#59baf8', '#40a7e5', '#3288b8'],
      '#f38ba8': ['#f5a9b8', '#f87aa0', '#f95c85', '#e54a70']
    };
    const palette = colors[baseColor] || colors['#89b4fa'];
    return palette[Math.min(segmentIndex - 1, palette.length - 1)] || baseColor;
  }

  spawnFood() {
    let pos; 
    const collides = (p) => {
      // 检查是否与蛇身体重叠
      for (const s of this.snakes) {
        if (!s.alive) continue;
        for (const seg of s.body) {
          if (seg.x === p.x && seg.y === p.y) return true;
        }
      }
      // 检查是否与已有食物重叠
      for (const f of this.foods) {
        if (f && f.pos && f.pos.x === p.x && f.pos.y === p.y) return true;
      }
      return false;
    };
    
    let attempts = 0;
    do { 
      pos = { 
        x: Math.floor(Math.random() * GRID_COLS), 
        y: Math.floor(Math.random() * GRID_ROWS) 
      }; 
      attempts++; 
      if (attempts > 200) {
        console.warn('食物生成失败，使用备用位置');
        return;
      }
    } while (collides(pos));
    
    // 按权重随机选择食物类型
    let rand = Math.random();
    let type = 'apple';
    if (rand < 0.6) type = 'apple'; 
    else if (rand < 0.9) type = 'banana'; 
    else type = 'cherry';
    
    const cfg = FOOD_TYPES[type];
    this.foods.push({ 
      pos, 
      type, 
      score: cfg.score, 
      color: cfg.color, 
      icon: cfg.icon 
    });
    
    // 确保不超过最大食物数量
    if (this.foods.length > MAX_FOOD) this.foods.splice(0, this.foods.length - MAX_FOOD);
  }

  // 其余方法保持不变（为简洁省略，但需要保留）
  getSavePayload() {
    return { 
      snakes: this.snakes.map(s => ({
        ...s,
        body: s.body.map(p => ({...p}))
      })), 
      foods: this.foods.map(f => ({...f, pos: {...f.pos}})), 
      difficulty: this.difficulty, 
      gameSpeedMs: this.gameSpeedMs, 
      mode: this.mode, 
      timestamp: Date.now() 
    };
  }

  restoreSavedState() {
    const state = this.loadSavedState(); if (!state) return;
    this.snakes = state.snakes || this.snakes; this.foods = state.foods || this.foods;
    this.difficulty = state.difficulty || this.difficulty; this.gameSpeedMs = state.gameSpeedMs || this.gameSpeedMs;
    this.mode = state.mode || this.mode; this.updateScoreUI(); this.hideRestorePrompt();
    this.gameRunning = true; this.gamePaused = false;
    if (this.startScreen) this.startScreen.classList.remove('active');
    if (this.gameOverScreen) this.gameOverScreen.classList.remove('active');
    this.gameLoop();
    this.frameCount = 0; // 重置帧计数
  }

  clearSavedState() { try { localStorage.removeItem('snakeSavedState'); } catch (e) {} }

  returnToMenu() {
    this.gameRunning = false; if (this.animationId) clearTimeout(this.animationId);
    if (this.gameOverScreen) this.gameOverScreen.classList.remove('active');
    if (this.startScreen) this.startScreen.classList.add('active');
  }

  togglePause() {
    if (!this.gameRunning) return;
    this.gamePaused = !this.gamePaused;
    if (this.gamePaused) { this.showPauseMenu(); this.saveGameState(); }
    else { this.hidePauseMenu(); this.gameLoop(); }
  }

  endFromPause() {
    this.hidePauseMenu(); this.gamePaused = false; this.gameRunning = false;
    if (this.animationId) clearTimeout(this.animationId);
    const alive = this.snakes.filter(s => s.alive);
    let text = '游戏结束';
    if (alive.length === 1) text = `玩家 ${alive[0].id + 1} 获胜！ 得分 ${alive[0].score}`;
    else if (alive.length === 0) text = '平局 / 无存活玩家';
    if (this.finalScoreEl) this.finalScoreEl.textContent = text;
    if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
    this.clearSavedState();
  }

  isEqual(a, b) { return !!a && !!b && a.x === b.x && a.y === b.y; }

  updateScoreUI() {
    if (this.snakes && this.snakes[0]) this.scoreEl.textContent = String(this.snakes[0].score || 0);
    else this.scoreEl.textContent = String(this.score || 0);
    if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore || 0);
  }

  loadHighScore() {
    try { const s = localStorage.getItem('snakeHighScore'); this.highScore = s ? parseInt(s, 10) : 0; }
    catch (e) { this.highScore = 0; }
    this.updateScoreUI();
  }

  saveHighScore() { try { localStorage.setItem('snakeHighScore', String(this.highScore || 0)); } catch (e) {} }

  saveGameState() { 
    try { 
      localStorage.setItem('snakeSavedState', JSON.stringify(this.getSavePayload())); 
    } catch (e) {
      console.warn('保存游戏状态失败:', e);
    } 
  }

  hasSavedState() { try { return !!localStorage.getItem('snakeSavedState'); } catch (e) { return false; } }

  loadSavedState() { 
    try { 
      const raw = localStorage.getItem('snakeSavedState'); 
      if (!raw) return null; 
      return JSON.parse(raw); 
    } catch (e) { 
      console.warn('加载游戏状态失败:', e);
      return null; 
    } 
  }

  showPauseMenu() { if (this.pauseMenu) this.pauseMenu.classList.add('active'); }
  hidePauseMenu() { if (this.pauseMenu) this.pauseMenu.classList.remove('active'); }


  // 替换 showRestorePrompt 方法
showRestorePrompt() {
  if (!this.restorePrompt) return;
  
  // 确保只显示恢复提示（隐藏其他所有UI）
  if (this.startScreen) this.startScreen.classList.remove('active');
  if (this.gameOverScreen) this.gameOverScreen.classList.remove('active');
  if (this.pauseMenu) this.pauseMenu.classList.remove('active');
  
  // 直接覆盖在canvas上
  this.restorePrompt.style.position = 'absolute';
  this.restorePrompt.style.left = '0';
  this.restorePrompt.style.top = '0';
  this.restorePrompt.style.width = '100%';
  this.restorePrompt.style.height = '100%';
  this.restorePrompt.style.zIndex = '2000';
  this.restorePrompt.classList.add('active');
  
  this.canvas.parentElement.appendChild(this.restorePrompt);
}

// 替换 startGame 方法
startGame() {
  // 隐藏所有UI层
  if (this.startScreen) this.startScreen.classList.remove('active');
  if (this.gameOverScreen) this.gameOverScreen.classList.remove('active');
  if (this.pauseMenu) this.pauseMenu.classList.remove('active');
  if (this.restorePrompt) this.restorePrompt.classList.remove('active');
  
  this.hideRestorePrompt();
  this.hidePauseMenu();
  this.clearSavedState();
  this.resetGame();
  
  this.gameRunning = true; 
  this.gamePaused = false;
  this.frameCount = 0;
  
  this.gameLoop();
}

// 新增：确保UI状态一致
ensureUIState() {
  // 恢复游戏时：只显示游戏，隐藏所有UI
  if (this.gameRunning && !this.gamePaused) {
    if (this.startScreen) this.startScreen.classList.remove('active');
    if (this.gameOverScreen) this.gameOverScreen.classList.remove('active');
    if (this.pauseMenu) this.pauseMenu.classList.remove('active');
    if (this.restorePrompt) this.restorePrompt.classList.remove('active');
  }
  // 其他状态由具体方法处理
}

  hideRestorePrompt() {
    if (!this.restorePrompt) return;
    this.restorePrompt.classList.remove('active');
    this.restorePrompt.style.display = 'none';
  }
}

// Polyfill for roundRect (if not supported)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

document.addEventListener('DOMContentLoaded', () => new SnakeGame());