/**
 * 五子棋主控制器 - 串联游戏、AI、复盘和UI
 */
class GomokuApp {
  constructor() {
    this.game = new GomokuGame(15);
    this.ai = new GomokuAI('medium');
    this.review = new ReviewModule();
    this.humanPlayer = 1;    // 默认人类执黑（先手）
    this.aiThinking = false;
    this.showCoordinates = true;

    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');
    this.cellSize = 0;
    this.padding = 0;
    this.hoverPos = null;

    this.bindEvents();
    this.resizeCanvas();
    this.draw();
    this.updateStatus('请选择先后手，然后开始对局');
  }

  // ============ 事件绑定 ============

  bindEvents() {
    // 画布点击
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoverPos = null;
      this.draw();
    });

    // 按钮
    document.getElementById('btn-black').addEventListener('click', () => this.startGame(1));
    document.getElementById('btn-white').addEventListener('click', () => this.startGame(2));
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('btn-review').addEventListener('click', () => this.showReview());

    // 难度选择
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.ai.setDifficulty(e.target.dataset.diff);
      });
    });

    // 窗口缩放
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.draw();
    });
  }

  // ============ 画布尺寸 ============

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const maxSize = Math.min(container.clientWidth, 680);
    this.canvas.width = maxSize;
    this.canvas.height = maxSize;
    this.padding = Math.floor(maxSize * 0.04);
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pos = this.pixelToBoard(x, y);
    if (!pos || !this.game.isValidMove(pos.row, pos.col)) return;

    this.game.makeMove(pos.row, pos.col);
    this.draw();

    if (this.game.gameOver) {
      this.onGameEnd();
    } else {
      this.aiMove();
    }
  }

  handleHover(e) {
    if (this.aiThinking || this.game.gameOver || this.game.currentPlayer !== this.humanPlayer) {
      this.hoverPos = null;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pos = this.pixelToBoard(e.clientX - rect.left, e.clientY - rect.top);
    if (pos && this.game.isValidMove(pos.row, pos.col)) {
      this.hoverPos = pos;
    } else {
      this.hoverPos = null;
    }
    this.draw();
  }

  // ============ AI 落子 ============

  aiMove() {
    this.aiThinking = true;
    this.updateStatus('AI 思考中...');
    this.canvas.style.cursor = 'wait';

    // 用 setTimeout 让 UI 先刷新
    setTimeout(() => {
      const aiPlayer = this.humanPlayer === 1 ? 2 : 1;
      const move = this.ai.bestMove(this.game, aiPlayer);
      if (move) {
        this.game.makeMove(move.row, move.col);
      }
      this.aiThinking = false;
      this.canvas.style.cursor = 'pointer';
      this.draw();

      if (this.game.gameOver) {
        this.onGameEnd();
      } else {
        this.updateStatus('轮到你落子');
      }
    }, 100);
  }

  // ============ 游戏流程 ============

  startGame(humanColor) {
    this.game.reset();
    this.humanPlayer = humanColor;
    document.getElementById('btn-black').classList.toggle('selected', humanColor === 1);
    document.getElementById('btn-white').classList.toggle('selected', humanColor === 2);
    document.getElementById('btn-review').style.display = 'none';
    this.draw();

    const colorName = humanColor === 1 ? '黑棋（先手）' : '白棋（后手）';
    this.updateStatus(`你执${colorName}，请落子`);

    // 如果人类执白，AI先走
    if (humanColor === 2) {
      this.aiMove();
    }
  }

  undo() {
    if (this.aiThinking || this.game.history.length === 0) return;
    // 撤销AI和人类各一步
    this.game.undoMove();
    if (this.game.history.length > 0 &&
        this.game.history[this.game.history.length - 1].player !== this.humanPlayer) {
      this.game.undoMove();
    }
    this.game.gameOver = false;
    this.game.winner = 0;
    this.game.winLine = null;
    this.draw();
    this.updateStatus('已悔棋，轮到你落子');
  }

  restart() {
    this.game.reset();
    document.getElementById('btn-review').style.display = 'none';
    this.draw();
    this.updateStatus('请选择先后手，然后开始对局');

    if (this.humanPlayer === 2) {
      this.startGame(2);
    }
  }

  onGameEnd() {
    let msg = '';
    if (this.game.winner === this.humanPlayer) {
      msg = '🎉 恭喜你赢了！';
    } else if (this.game.winner === 3) {
      msg = '🤝 平局！';
    } else {
      msg = '😤 AI 赢了，再接再厉！';
    }
    this.updateStatus(msg);
    document.getElementById('btn-review').style.display = 'inline-block';
    this.draw();
  }

  // ============ 复盘 ============

  async showReview() {
    const panel = document.getElementById('review-panel');
    const content = document.getElementById('review-content');
    panel.style.display = 'block';
    content.innerHTML = '<div class="loading">🤔 AI教练正在分析棋局...</div>';

    const diff = this.ai.difficulty;
    const text = await this.review.analyze(this.game, this.humanPlayer, diff);

    // 简单 markdown 渲染
    content.innerHTML = this.renderMarkdown(text);
    panel.scrollIntoView({ behavior: 'smooth' });
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
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  }

  // ============ 绘制 ============

  draw() {
    const ctx = this.ctx;
    const size = this.game.size;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 背景
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 木纹效果
    ctx.fillStyle = 'rgba(160, 120, 60, 0.08)';
    for (let i = 0; i < this.canvas.height; i += 4) {
      ctx.fillRect(0, i, this.canvas.width, 2);
    }

    // 网格线
    ctx.strokeStyle = '#5a3e1b';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i++) {
      const p1 = this.boardToPixel(i, 0);
      const p2 = this.boardToPixel(i, size - 1);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

      const p3 = this.boardToPixel(0, i);
      const p4 = this.boardToPixel(size - 1, i);
      ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
    }

    // 坐标标注
    if (this.showCoordinates) {
      ctx.fillStyle = '#5a3e1b';
      ctx.font = `${Math.max(10, this.cellSize * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cols = 'ABCDEFGHIJKLMNO';
      for (let i = 0; i < size; i++) {
        const p = this.boardToPixel(0, i);
        ctx.fillText(cols[i], p.x, this.padding * 0.45);
        const p2 = this.boardToPixel(i, 0);
        ctx.fillText(String(i + 1), this.padding * 0.4, p2.y);
      }
    }

    // 星位
    const stars = size === 15 ? [[3,3],[3,11],[7,7],[11,3],[11,11]] : [[3,3],[3,size-4],[Math.floor(size/2),Math.floor(size/2)],[size-4,3],[size-4,size-4]];
    ctx.fillStyle = '#5a3e1b';
    for (const [r, c] of stars) {
      const p = this.boardToPixel(r, c);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, this.cellSize * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }

    // 悬停预览
    if (this.hoverPos) {
      const p = this.boardToPixel(this.hoverPos.row, this.hoverPos.col);
      const r = this.cellSize * 0.42;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.humanPlayer === 1 ? '#111' : '#f5f5f5';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 棋子
    const stoneR = this.cellSize * 0.44;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = this.game.board[r][c];
        if (v === 0) continue;
        const p = this.boardToPixel(r, c);

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y + 2, stoneR, 0, Math.PI * 2);
        ctx.fill();

        // 棋子
        if (v === 1) {
          const grad = ctx.createRadialGradient(p.x - stoneR * 0.3, p.y - stoneR * 0.3, stoneR * 0.1, p.x, p.y, stoneR);
          grad.addColorStop(0, '#555');
          grad.addColorStop(1, '#111');
          ctx.fillStyle = grad;
        } else {
          const grad = ctx.createRadialGradient(p.x - stoneR * 0.3, p.y - stoneR * 0.3, stoneR * 0.1, p.x, p.y, stoneR);
          grad.addColorStop(0, '#fff');
          grad.addColorStop(1, '#ccc');
          ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, stoneR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = v === 1 ? '#000' : '#999';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // 最后一手标记
    if (this.game.lastMove) {
      const p = this.boardToPixel(this.game.lastMove.row, this.game.lastMove.col);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, stoneR * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 获胜连线
    if (this.game.winLine && this.game.winLine.length >= 5) {
      const first = this.boardToPixel(this.game.winLine[0].row, this.game.winLine[0].col);
      const last = this.boardToPixel(
        this.game.winLine[this.game.winLine.length - 1].row,
        this.game.winLine[this.game.winLine.length - 1].col
      );
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }

  // ============ 状态栏 ============

  updateStatus(msg) {
    document.getElementById('status').textContent = msg;
  }
}

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GomokuApp();
});
