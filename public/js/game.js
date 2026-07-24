/**
 * 五子棋核心游戏逻辑
 * 15×15 棋盘，无禁手规则
 */
class GomokuGame {
  constructor(size = 15) {
    this.size = size;
    this.reset();
  }

  reset() {
    // 0=空, 1=黑, 2=白
    this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.history = [];       // [{row, col, player}]
    this.currentPlayer = 1;  // 黑先
    this.winner = 0;         // 0=未结束, 1=黑胜, 2=白胜, 3=平局
    this.winLine = null;     // 获胜连线坐标
    this.gameOver = false;
    this.lastMove = null;
  }

  /** 判断落子是否合法 */
  isValidMove(row, col) {
    return !this.gameOver &&
      row >= 0 && row < this.size &&
      col >= 0 && col < this.size &&
      this.board[row][col] === 0;
  }

  /** 落子，返回是否成功 */
  makeMove(row, col) {
    if (!this.isValidMove(row, col)) return false;
    this.board[row][col] = this.currentPlayer;
    this.lastMove = { row, col, player: this.currentPlayer };
    this.history.push({ row, col, player: this.currentPlayer });

    const winResult = this.checkWin(row, col, this.currentPlayer);
    if (winResult) {
      this.winner = this.currentPlayer;
      this.winLine = winResult;
      this.gameOver = true;
    } else if (this.history.length === this.size * this.size) {
      this.winner = 3; // 平局
      this.gameOver = true;
    } else {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }
    return true;
  }

  /** 撤销上一步 */
  undoMove() {
    if (this.history.length === 0) return null;
    const last = this.history.pop();
    this.board[last.row][last.col] = 0;
    this.currentPlayer = last.player;
    this.winner = 0;
    this.winLine = null;
    this.gameOver = false;
    this.lastMove = this.history.length > 0
      ? { ...this.history[this.history.length - 1] }
      : null;
    return last;
  }

  /** 检测是否获胜，返回获胜连线坐标数组或null */
  checkWin(row, col, player) {
    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 对角线 ↘
      [1, -1],  // 对角线 ↙
    ];

    for (const [dr, dc] of directions) {
      let line = [{ row, col }];

      // 正方向延伸
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) break;
        if (this.board[r][c] !== player) break;
        line.push({ row: r, col: c });
      }
      // 反方向延伸
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i, c = col - dc * i;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) break;
        if (this.board[r][c] !== player) break;
        line.unshift({ row: r, col: c });
      }

      if (line.length >= 5) return line;
    }
    return null;
  }

  /** 获取所有候选落子位置（已有棋子周围2格内） */
  getCandidates(radius = 2) {
    const candidates = new Set();
    const hasStone = this.history.length > 0;

    if (!hasStone) {
      // 空棋盘，返回中心点
      const mid = Math.floor(this.size / 2);
      return [{ row: mid, col: mid }];
    }

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) continue;
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && this.board[nr][nc] === 0) {
              candidates.add(nr * this.size + nc);
            }
          }
        }
      }
    }
    return [...candidates].map(v => ({ row: Math.floor(v / this.size), col: v % this.size }));
  }

  /** 导出棋谱为文本 */
  exportMoves() {
    const cols = 'ABCDEFGHIJKLMNO';
    return this.history.map((m, i) => {
      const name = m.player === 1 ? '黑' : '白';
      return `第${i + 1}手 ${name} ${cols[m.col]}${m.row + 1}`;
    }).join('\n');
  }

  /** 获取棋盘的简洁文本表示 */
  boardToText() {
    const cols = 'ABCDEFGHIJKLMNO';
    let text = '   ' + cols.split('').join(' ') + '\n';
    for (let r = 0; r < this.size; r++) {
      text += String(r + 1).padStart(2) + ' ';
      for (let c = 0; c < this.size; c++) {
        const v = this.board[r][c];
        text += (v === 0 ? '·' : v === 1 ? '●' : '○') + ' ';
      }
      text += '\n';
    }
    return text;
  }

  /** 检测指定玩家面对的威胁（敌方即将成五或活四/活三的点） */
  detectThreats(player) {
    const opponent = player === 1 ? 2 : 1;
    const threats = []; // [{row, col, level: 'critical'|'warning', type: string}]
    const candidates = this.getCandidates(2);

    for (const m of candidates) {
      // 1. 检查对手一步五连（绝杀级致命威胁）
      this.board[m.row][m.col] = opponent;
      if (this.checkWin(m.row, m.col, opponent)) {
        threats.push({ row: m.row, col: m.col, level: 'critical', type: '绝杀威胁：对方一步即可成五！' });
        this.board[m.row][m.col] = 0;
        continue;
      }
      this.board[m.row][m.col] = 0;

      // 2. 检查对手形成活四或双三
      this.board[m.row][m.col] = opponent;
      const directions = [[0,1],[1,0],[1,1],[1,-1]];
      let liveThrees = 0;
      let fours = 0;
      for (const [dr, dc] of directions) {
        const lineVal = this.checkLineShape(m.row, m.col, dr, dc, opponent);
        if (lineVal.count >= 4 && lineVal.block === 0) fours++;
        else if (lineVal.count === 3 && lineVal.block === 0) liveThrees++;
      }
      this.board[m.row][m.col] = 0;

      if (fours > 0) {
        threats.push({ row: m.row, col: m.col, level: 'critical', type: '冲四/活四预警：需立即拦截' });
      } else if (liveThrees >= 2) {
        threats.push({ row: m.row, col: m.col, level: 'critical', type: '双三陷阱：拦截点' });
      } else if (liveThrees === 1) {
        threats.push({ row: m.row, col: m.col, level: 'warning', type: '活三预警：对方正在造势' });
      }
    }
    return threats;
  }

  /** 辅助检查线型特征 */
  checkLineShape(row, col, dr, dc, player) {
    let count = 1, block = 0;
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
      count++; r += dr; c += dc;
    }
    if (r < 0 || r >= this.size || c < 0 || c >= this.size || this.board[r][c] !== 0) block++;

    r = row - dr; c = col - dc;
    while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
      count++; r -= dr; c -= dc;
    }
    if (r < 0 || r >= this.size || c < 0 || c >= this.size || this.board[r][c] !== 0) block++;

    return { count, block };
  }

  /** 动态生成教练局中提示 */
  getHint(player, aiEngine) {
    if (this.gameOver) return null;
    const cols = 'ABCDEFGHIJKLMNO';
    const opponent = player === 1 ? 2 : 1;
    const best = aiEngine.bestMove(this, player);
    if (!best) return null;

    const posStr = `${cols[best.col]}${best.row + 1}`;

    // 判断理由
    this.board[best.row][best.row] = player;
    // 检查是否绝杀
    if (this.checkWin(best.row, best.col, player)) {
      this.board[best.row][best.row] = 0;
      return { move: best, posStr, type: 'win', title: '绝杀机会！', desc: `推荐落子 ${posStr}，可直接连成五子赢得比赛！` };
    }
    this.board[best.row][best.row] = 0;

    // 检查是否防守对方绝杀/冲四
    this.board[best.row][best.col] = opponent;
    if (this.checkWin(best.row, best.col, opponent)) {
      this.board[best.row][best.col] = 0;
      return { move: best, posStr, type: 'block', title: '紧急防守！', desc: `必须落子 ${posStr}！拦截对方的五连致命威胁。` };
    }
    this.board[best.row][best.col] = 0;

    const threats = this.detectThreats(player);
    if (threats.some(t => t.level === 'critical')) {
      return { move: best, posStr, type: 'block', title: '关键防守', desc: `推荐落子 ${posStr}，优先化解对方的冲四/活三杀招。` };
    }

    return { move: best, posStr, type: 'develop', title: '攻守兼备', desc: `推荐落子 ${posStr}，抢占要道并扩展己方棋势。` };
  }
}

// 支持模块化导出和浏览器全局
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GomokuGame;
}
