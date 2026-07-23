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
}

// 支持模块化导出和浏览器全局
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GomokuGame;
}
