/**
 * 五子棋主控制器 - 串联游戏、AI、复盘、动画与音效
 */
class GomokuApp {
  constructor() {
    this.game = new GomokuGame(15);
    this.ai = new GomokuAI('medium');
    this.review = new ReviewModule();
    this.humanPlayer = 1;
    this.aiThinking = false;
    this.hoverPos = null;
    this.startedAt = null;

    // 战绩（localStorage 持久化）
    this.stats = JSON.parse(localStorage.getItem('gomoku-stats') || '{"wins":0,"losses":0,"games":0}');

    // 落子动画
    this.animations = []; // {row, col, start}

    // 音效
    this.soundOn = localStorage.getItem('gomoku-sound') !== 'off';
    this.audioCtx = null;

    // 教练提示轮换
    this.tips = [
      '开局占天元，八个方向皆可成势。活三不如冲四，冲四不如做杀——制造「必须回应」的威胁，是赢棋的关键。',
      '斜线比直线更隐蔽。双三、四三是无禁手规则下最锋利的杀招，落子前先想：这一步之后我能同时造出几个威胁？',
      '防守不只是堵：挡在对方棋型的「活端」，同时让自己的棋子也连成势力，一子双用才是高手。',
      '冲四是最强的先手——对方必须应。连续冲四（VCF）往往能直接导向胜利，算棋时先找冲四点。',
      '残局阶段，一枚过河小卒价值翻倍。别急着进攻，先把棋子走「厚」，势力连成一片，杀招自然出现。'
    ];
    this.tipIndex = Math.floor(Math.random() * this.tips.length);

    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');
    this.cellSize = 0;
    this.padding = 0;

    this.bindEvents();
    this.resizeCanvas();
    this.renderStats();
    this.renderMoveList();
    this.updateTurnIndicator();
    this.rotateTip();
    setInterval(() => this.rotateTip(), 20000);
    this.startRenderLoop();
  }

  // ============ 音效（Web Audio，无外部文件） ============

  ensureAudio() {
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { /* 忽略 */ }
    }
    return this.audioCtx;
  }

  playStone() {
    if (!this.soundOn) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    // 清脆的落子声：短促噪声 + 低频敲击
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playWin(fanfare) {
    if (!this.soundOn) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    const notes = fanfare ? [523, 659, 784, 1047] : [392, 330];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  // ============ 事件绑定 ============

  bindEvents() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
    this.canvas.addEventListener('mouseleave', () => { this.hoverPos = null; });

    document.getElementById('btn-black').addEventListener('click', () => this.startGame(1));
    document.getElementById('btn-white').addEventListener('click', () => this.startGame(2));
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('result-again').addEventListener('click', () => this.restart());
    document.getElementById('result-review').addEventListener('click', () => {
      this.hideResult();
      this.showReview();
    });
    document.getElementById('btn-sound').addEventListener('click', (e) => {
      this.soundOn = !this.soundOn;
      localStorage.setItem('gomoku-sound', this.soundOn ? 'on' : 'off');
      e.target.textContent = this.soundOn ? '🔊' : '🔇';
    });
    if (!this.soundOn) document.getElementById('btn-sound').textContent = '🔇';

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('chip--active'));
        e.target.classList.add('chip--active');
        this.ai.setDifficulty(e.target.dataset.diff);
        const names = { easy: '入门', medium: '进阶', hard: '高手' };
        this.flashStatus(`AI 难度已切换为「${names[e.target.dataset.diff]}」`);
      });
    });

    window.addEventListener('resize', () => { this.resizeCanvas(); this.draw(); });
  }

  // ============ 画布尺寸 ============

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const maxSize = Math.min(container.clientWidth - 28, 660);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = maxSize * dpr;
    this.canvas.height = maxSize * dpr;
    this.canvas.style.width = maxSize + 'px';
    this.canvas.style.height = maxSize + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewSize = maxSize;
    this.padding = Math.floor(maxSize * 0.045);
    this.cellSize = (maxSize - this.padding * 2) / (this.game.size - 1);
  }

  // ============ 坐标转换 ============

  pixelToBoard(x, y) {
    const col = Math.round((x - this.padding) / this.cellSize);
    const row = Math.round((y - this.padding) / this.cellSize);
    if (row >= 0 && row < this.game.size && col >= 0 && col < this.game.size) {
      return { row, col };
    }
    return null;
  }

  boardToPixel(row, col) {
    return {
      x: this.padding + col * this.cellSize,
      y: this.padding + row * this.cellSize,
    };
  }

  // ============ 交互处理 ============

  handleClick(e) {
    if (this.aiThinking || this.game.gameOver) return;
    if (this.game.currentPlayer !== this.humanPlayer) return;

    const rect = this.canvas.getBoundingClientRect();
    const pos = this.pixelToBoard(e.clientX - rect.left, e.clientY - rect.top);
    if (!pos || !this.game.isValidMove(pos.row, pos.col)) return;

    this.placeStone(pos.row, pos.col, this.humanPlayer);
  }

  handleHover(e) {
    if (this.aiThinking || this.game.gameOver || this.game.currentPlayer !== this.humanPlayer) {
      if (this.hoverPos) { this.hoverPos = null; }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pos = this.pixelToBoard(e.clientX - rect.left, e.clientY - rect.top);
    this.hoverPos = (pos && this.game.isValidMove(pos.row, pos.col)) ? pos : null;
  }

  /** 落子统一入口：更新游戏、动画、音效、棋谱 */
  placeStone(row, col, player) {
    if (!this.game.makeMove(row, col)) return;
    this.animations.push({ row, col, start: performance.now() });
    this.playStone();
    this.renderMoveList();
    this.updateTurnIndicator();

    if (this.game.gameOver) {
      this.onGameEnd();
    } else if (player === this.humanPlayer) {
      this.aiMove();
    } else {
      this.flashStatus('轮到你落子');
    }
  }

  // ============ AI 落子 ============

  aiMove() {
    this.aiThinking = true;
    this.flashStatus('AI 正在思考…', true);
    this.canvas.style.cursor = 'wait';

    setTimeout(() => {
      const aiPlayer = this.humanPlayer === 1 ? 2 : 1;
      const move = this.ai.bestMove(this.game, aiPlayer);
      this.aiThinking = false;
      this.canvas.style.cursor = 'pointer';
      if (move) {
        this.placeStone(move.row, move.col, aiPlayer);
      }
    }, 250 + Math.random() * 300);
  }

  // ============ 游戏流程 ============

  startGame(humanColor) {
    this.game.reset();
    this.animations = [];
    this.humanPlayer = humanColor;
    this.startedAt = Date.now();
    this.hideResult();
    document.getElementById('review-panel').style.display = 'none';

    document.getElementById('btn-black').classList.toggle('chip--active', humanColor === 1);
    document.getElementById('btn-white').classList.toggle('chip--active', humanColor === 2);

    const humanSide = humanColor === 1 ? '执黑先行' : '执白后行';
    const aiSide = humanColor === 1 ? '执白后行' : '执黑先行';
    document.getElementById('human-side').textContent = humanSide;
    document.getElementById('ai-side').textContent = aiSide;

    // 棋子圆点颜色跟随先后手
    const humanDot = document.querySelector('.stone-dot--human');
    const aiDot = document.querySelector('.stone-dot--ai');
    humanDot.classList.toggle('is-black', humanColor === 1);
    humanDot.classList.toggle('is-white', humanColor === 2);
    aiDot.classList.toggle('is-black', humanColor === 2);
    aiDot.classList.toggle('is-white', humanColor === 1);

    this.renderMoveList();
    this.updateTurnIndicator();
    this.draw();

    const colorName = humanColor === 1 ? '黑棋 · 先手' : '白棋 · 后手';
    this.flashStatus(`对局开始 — 你执${colorName}`);

    if (humanColor === 2) {
      this.aiMove();
    }
  }

  undo() {
    if (this.aiThinking || this.game.history.length === 0) return;
    this.game.undoMove();
    if (this.game.history.length > 0 &&
        this.game.history[this.game.history.length - 1].player !== this.humanPlayer) {
      this.game.undoMove();
    }
    this.animations = [];
    this.game.gameOver = false;
    this.game.winner = 0;
    this.game.winLine = null;
    this.hideResult();
    this.renderMoveList();
    this.updateTurnIndicator();
    this.draw();
    this.flashStatus('已悔棋 — 轮到你落子');
  }

  restart() {
    this.startGame(this.humanPlayer);
  }

  onGameEnd() {
    this.stats.games++;
    const humanWon = this.game.winner === this.humanPlayer;
    const draw = this.game.winner === 3;
    if (humanWon) this.stats.wins++;
    else if (!draw) this.stats.losses++;
    localStorage.setItem('gomoku-stats', JSON.stringify(this.stats));
    this.renderStats(true);

    // 结算信息
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    const mm = Math.floor(elapsed / 60), ss = String(elapsed % 60).padStart(2, '0');
    document.getElementById('result-sub').textContent =
      `共 ${this.game.history.length} 手 · 用时 ${mm}分${ss}秒`;

    const stamp = document.getElementById('result-stamp');
    const title = document.getElementById('result-title');
    if (humanWon) {
      stamp.textContent = '胜';
      stamp.classList.remove('result-stamp--gold');
      title.textContent = '恭喜，你赢了！';
      this.flashStatus('🎉 恭喜获胜！', false, true);
      this.playWin(true);
    } else if (draw) {
      stamp.textContent = '和';
      stamp.classList.add('result-stamp--gold');
      title.textContent = '平分秋色';
      this.flashStatus('🤝 平局');
      this.playWin(false);
    } else {
      stamp.textContent = '负';
      stamp.classList.add('result-stamp--gold');
      title.textContent = '惜败，再接再厉';
      this.flashStatus('😤 AI 获胜 — 点复盘看看问题出在哪', false, true);
      this.playWin(false);
    }

    this.updateTurnIndicator();
    setTimeout(() => this.showResult(), 650);
  }

  showResult() { document.getElementById('result-overlay').classList.add('is-visible'); }
  hideResult() { document.getElementById('result-overlay').classList.remove('is-visible'); }

  // ============ 回合指示 ============

  updateTurnIndicator() {
    const humanTurn = !this.game.gameOver && this.game.currentPlayer === this.humanPlayer;
    const aiTurn = !this.game.gameOver && this.game.currentPlayer !== this.humanPlayer;
    document.getElementById('turn-human').classList.toggle('is-active', humanTurn);
    document.getElementById('turn-ai').classList.toggle('is-active', aiTurn || this.aiThinking);
  }

  // ============ 棋谱 ============

  renderMoveList() {
    const list = document.getElementById('move-list');
    const cols = 'ABCDEFGHIJKLMNO';
    document.getElementById('move-count').textContent = `${this.game.history.length} 手`;

    if (this.game.history.length === 0) {
      list.innerHTML = '<li class="move-list__empty">落子后，棋谱将记录在这里</li>';
      return;
    }

    list.innerHTML = this.game.history.map((m, i) => {
      const isHuman = m.player === this.humanPlayer;
      const latest = i === this.game.history.length - 1 ? ' is-latest' : '';
      return `<li class="${latest}">
        <span class="mv-num">${i + 1}</span>
        <span class="mv-stone mv-stone--${m.player === 1 ? 'b' : 'w'}"></span>
        <span class="mv-who">${isHuman ? '你' : 'AI'}</span>
        <span class="mv-pos">${cols[m.col]}${m.row + 1}</span>
      </li>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  // ============ 战绩 ============

  renderStats(bump = false) {
    const map = { 'stat-wins': this.stats.wins, 'stat-losses': this.stats.losses, 'stat-games': this.stats.games };
    for (const [id, val] of Object.entries(map)) {
      const el = document.getElementById(id);
      el.textContent = val;
      if (bump) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }
  }

  // ============ 提示轮换 ============

  rotateTip() {
    this.tipIndex = (this.tipIndex + 1) % this.tips.length;
    const el = document.getElementById('tip-text');
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = this.tips[this.tipIndex];
      el.style.transition = 'opacity 0.6s';
      el.style.opacity = 1;
    }, 300);
  }

  // ============ 复盘 ============

  async showReview() {
    const panel = document.getElementById('review-panel');
    const content = document.getElementById('review-content');
    panel.style.display = 'block';
    content.innerHTML = '<div class="loading">AI 教练正在复盘你的棋局，请稍候…</div>';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const text = await this.review.analyze(this.game, this.humanPlayer, this.ai.difficulty);
    content.innerHTML = this.renderMarkdown(text);
  }

  renderMarkdown(text) {
    return text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  }

  // ============ 状态栏 ============

  flashStatus(msg, thinking = false, win = false) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.classList.toggle('is-win', win);
    el.style.opacity = 0.3;
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.4s';
      el.style.opacity = 1;
    });
  }

  // ============ 渲染循环（落子动画） ============

  startRenderLoop() {
    const loop = () => {
      // 有动画进行或悬停时重绘
      const now = performance.now();
      this.animations = this.animations.filter(a => now - a.start < 320);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ============ 绘制 ============

  draw() {
    const ctx = this.ctx;
    const size = this.game.size;
    const S = this.viewSize;
    if (!S) return;
    ctx.clearRect(0, 0, S, S);

    // 木纹棋盘底
    const woodGrad = ctx.createLinearGradient(0, 0, S, S);
    woodGrad.addColorStop(0, '#e2b26c');
    woodGrad.addColorStop(0.5, '#d9a860');
    woodGrad.addColorStop(1, '#cf9c52');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, S, S);

    // 木纹肌理
    ctx.strokeStyle = 'rgba(122, 82, 30, 0.10)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const y = (i / 14) * S + Math.sin(i * 2.7) * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(S * 0.3, y + 6, S * 0.6, y - 6, S, y + 3);
      ctx.stroke();
    }

    // 网格线
    ctx.strokeStyle = '#5a3c14';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i++) {
      const p1 = this.boardToPixel(i, 0), p2 = this.boardToPixel(i, size - 1);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const p3 = this.boardToPixel(0, i), p4 = this.boardToPixel(size - 1, i);
      ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
    }

    // 坐标
    ctx.fillStyle = '#5a3c14';
    ctx.font = `600 ${Math.max(9, this.cellSize * 0.28)}px 'Noto Sans SC', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cols = 'ABCDEFGHIJKLMNO';
    for (let i = 0; i < size; i++) {
      ctx.fillText(cols[i], this.boardToPixel(0, i).x, this.padding * 0.42);
      ctx.fillText(String(i + 1), this.padding * 0.38, this.boardToPixel(i, 0).y);
    }

    // 星位
    const mid = Math.floor(size / 2);
    const stars = [[3,3],[3,size-4],[mid,mid],[size-4,3],[size-4,size-4]];
    ctx.fillStyle = '#5a3c14';
    for (const [r, c] of stars) {
      const p = this.boardToPixel(r, c);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, this.cellSize * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }

    // 悬停预览
    if (this.hoverPos && !this.game.gameOver) {
      const p = this.boardToPixel(this.hoverPos.row, this.hoverPos.col);
      const r = this.cellSize * 0.42;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.humanPlayer === 1 ? '#111' : '#f5f2ea';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 悬停圈
      ctx.strokeStyle = 'rgba(200, 80, 46, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 棋子（带落子动画）
    const now = performance.now();
    const stoneR = this.cellSize * 0.44;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = this.game.board[r][c];
        if (v === 0) continue;
        const p = this.boardToPixel(r, c);

        // 落子弹跳动画
        let scale = 1, alpha = 1;
        const anim = this.animations.find(a => a.row === r && a.col === c);
        if (anim) {
          const t = Math.min((now - anim.start) / 320, 1);
          // ease-out-back 弹跳
          const c1 = 1.70158, c3 = c1 + 1;
          scale = 0.3 + 0.7 * (1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2));
          alpha = Math.min(t * 3, 1);
        }

        ctx.globalAlpha = alpha;
        const rr = stoneR * scale;

        // 投影
        ctx.fillStyle = 'rgba(60, 35, 8, 0.30)';
        ctx.beginPath();
        ctx.arc(p.x + 1.5, p.y + 2.5, rr, 0, Math.PI * 2);
        ctx.fill();

        // 棋子本体
        const grad = ctx.createRadialGradient(p.x - rr * 0.32, p.y - rr * 0.32, rr * 0.1, p.x, p.y, rr);
        if (v === 1) {
          grad.addColorStop(0, '#5c5c5c');
          grad.addColorStop(0.55, '#222');
          grad.addColorStop(1, '#0c0c0c');
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.6, '#efece4');
          grad.addColorStop(1, '#c9c3b5');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // 最新一手标记
    if (this.game.lastMove && !this.game.winLine) {
      const p = this.boardToPixel(this.game.lastMove.row, this.game.lastMove.col);
      ctx.strokeStyle = '#c8502e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneR * 0.48, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 获胜连线
    if (this.game.winLine && this.game.winLine.length >= 5) {
      const first = this.boardToPixel(this.game.winLine[0].row, this.game.winLine[0].col);
      const last = this.boardToPixel(
        this.game.winLine[this.game.winLine.length - 1].row,
        this.game.winLine[this.game.winLine.length - 1].col
      );
      // 发光连线
      ctx.strokeStyle = 'rgba(200, 80, 46, 0.35)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.lineTo(last.x, last.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(226, 104, 63, 0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.lineTo(last.x, last.y); ctx.stroke();

      // 获胜棋子描圈
      for (const cell of this.game.winLine) {
        const p = this.boardToPixel(cell.row, cell.col);
        ctx.strokeStyle = 'rgba(240, 196, 122, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, stoneR + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GomokuApp();
});
