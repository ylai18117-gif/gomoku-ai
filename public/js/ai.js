/**
 * 五子棋 AI 引擎
 * Minimax + Alpha-Beta 剪枝 + 棋型评估
 * 难度分级：简单(2层) / 中等(4层) / 困难(6层)
 */
class GomokuAI {
  constructor(difficulty = 'medium') {
    this.setDifficulty(difficulty);
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    const config = { easy: 2, medium: 4, hard: 6 };
    this.maxDepth = config[difficulty] || 4;
    // 简单模式加入随机扰动
    this.noise = difficulty === 'easy' ? 30 : (difficulty === 'medium' ? 8 : 0);
  }

  /** 计算最佳落子 */
  bestMove(game, aiPlayer) {
    const candidates = game.getCandidates(2);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // 快速检查：有无一步杀或必须堵的棋
    const urgent = this.findUrgentMove(game, aiPlayer, candidates);
    if (urgent) return urgent;

    let bestScore = -Infinity;
    let bestMoves = [];
    const opponent = aiPlayer === 1 ? 2 : 1;

    // 对候选点排序（启发式剪枝）
    const sorted = this.sortCandidates(game, candidates, aiPlayer);

    for (const move of sorted) {
      game.board[move.row][move.col] = aiPlayer;
      const score = this.minimax(
        game, this.maxDepth - 1, -Infinity, Infinity,
        false, aiPlayer, opponent
      );
      game.board[move.row][move.col] = 0;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    // 简单/中等模式随机选一个最优
    if (this.noise > 0 && bestMoves.length > 1) {
      return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }
    return bestMoves[0];
  }

  /** 检查紧急着法：自己能五连 / 对方要五连 */
  findUrgentMove(game, aiPlayer, candidates) {
    const opponent = aiPlayer === 1 ? 2 : 1;
    // 自己能连五
    for (const m of candidates) {
      game.board[m.row][m.col] = aiPlayer;
      if (game.checkWin(m.row, m.col, aiPlayer)) {
        game.board[m.row][m.col] = 0;
        return m;
      }
      game.board[m.row][m.col] = 0;
    }
    // 对方要连五，必须堵
    for (const m of candidates) {
      game.board[m.row][m.col] = opponent;
      if (game.checkWin(m.row, m.col, opponent)) {
        game.board[m.row][m.col] = 0;
        return m;
      }
      game.board[m.row][m.col] = 0;
    }
    return null;
  }

  /** 候选点排序（进攻+防守启发分） */
  sortCandidates(game, candidates, player) {
    const opponent = player === 1 ? 2 : 1;
    return candidates.map(m => {
      let score = 0;
      // 进攻分
      game.board[m.row][m.col] = player;
      score += this.evalPoint(game, m.row, m.col, player) * 1.1;
      game.board[m.row][m.col] = 0;
      // 防守分
      game.board[m.row][m.col] = opponent;
      score += this.evalPoint(game, m.row, m.col, opponent);
      game.board[m.row][m.col] = 0;
      return { ...m, score };
    }).sort((a, b) => b.score - a.score);
  }

  /** Minimax + Alpha-Beta */
  minimax(game, depth, alpha, beta, isMaximizing, aiPlayer, opponent) {
    // 终局检查
    if (game.lastMove) {
      const win = game.checkWin(game.lastMove.row, game.lastMove.col, game.lastMove.player);
      if (win) {
        return game.lastMove.player === aiPlayer ? 1000000 + depth : -1000000 - depth;
      }
    }
    if (depth === 0) {
      return this.evaluateBoard(game, aiPlayer, opponent);
    }

    const currentPlayer = isMaximizing ? aiPlayer : opponent;
    const candidates = this.sortCandidates(game, game.getCandidates(2), currentPlayer).slice(0, 12);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const m of candidates) {
        game.board[m.row][m.col] = currentPlayer;
        const prevLast = game.lastMove;
        game.lastMove = { row: m.row, col: m.col, player: currentPlayer };
        const eval_ = this.minimax(game, depth - 1, alpha, beta, false, aiPlayer, opponent);
        game.board[m.row][m.col] = 0;
        game.lastMove = prevLast;
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of candidates) {
        game.board[m.row][m.col] = currentPlayer;
        const prevLast = game.lastMove;
        game.lastMove = { row: m.row, col: m.col, player: currentPlayer };
        const eval_ = this.minimax(game, depth - 1, alpha, beta, true, aiPlayer, opponent);
        game.board[m.row][m.col] = 0;
        game.lastMove = prevLast;
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /** 评估整个棋局 */
  evaluateBoard(game, aiPlayer, opponent) {
    let score = 0;
    const size = game.size;
    const directions = [[0,1],[1,0],[1,1],[1,-1]];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = game.board[r][c];
        if (v === 0) continue;
        const multiplier = v === aiPlayer ? 1 : -1.05; // 略偏防守
        for (const [dr, dc] of directions) {
          // 只从起始端统计，避免重复
          const pr = r - dr, pc = c - dc;
          if (pr >= 0 && pr < size && pc >= 0 && pc < size && game.board[pr][pc] === v) continue;
          score += this.evalLine(game, r, c, dr, dc, v) * multiplier;
        }
      }
    }

    if (this.noise > 0) {
      score += (Math.random() - 0.5) * this.noise * 2;
    }
    return score;
  }

  /** 评估某个点在某方向上的棋型价值 */
  evalPoint(game, row, col, player) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    let total = 0;
    for (const [dr, dc] of directions) {
      total += this.evalLine(game, row, col, dr, dc, player);
    }
    return total;
  }

  /** 评估一条线（从起点沿方向） */
  evalLine(game, row, col, dr, dc, player) {
    const size = game.size;
    let count = 1;
    let block = 0;
    let empty1 = 0, empty2 = 0;

    // 正方向
    let r = row + dr, c = col + dc;
    let space = false;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      if (game.board[r][c] === player) {
        count++;
        if (space) empty1++;
      } else if (game.board[r][c] === 0) {
        if (!space && count < 5) { space = true; empty1++; r += dr; c += dc; continue; }
        break;
      } else {
        block++;
        break;
      }
      if (count >= 5) break;
      r += dr; c += dc;
    }
    if (r < 0 || r >= size || c < 0 || c >= size) block++;

    // 反方向
    space = false;
    r = row - dr; c = col - dc;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      if (game.board[r][c] === player) {
        count++;
        if (space) empty2++;
      } else if (game.board[r][c] === 0) {
        if (!space && count < 5) { space = true; empty2++; r -= dr; c -= dc; continue; }
        break;
      } else {
        block++;
        break;
      }
      if (count >= 5) break;
      r -= dr; c -= dc;
    }
    if (r < 0 || r >= size || c < 0 || c >= size) block++;

    return this.shapeScore(count, block, empty1 + empty2);
  }

  /** 棋型评分表 */
  shapeScore(count, block, empty) {
    if (count >= 5) return 100000;
    if (block === 2) return 0; // 死棋

    if (count === 4) {
      if (block === 0) return empty > 0 ? 9000 : 10000; // 活四/跳活四
      return 5000;  // 冲四
    }
    if (count === 3) {
      if (block === 0) return empty > 0 ? 3000 : 4000;  // 活三
      return 500;   // 眠三
    }
    if (count === 2) {
      if (block === 0) return empty > 0 ? 200 : 300;    // 活二
      return 50;    // 眠二
    }
    if (count === 1) {
      if (block === 0) return empty > 0 ? 10 : 15;
      return 3;
    }
    return 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GomokuAI;
}
