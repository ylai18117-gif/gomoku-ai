/**
 * 复盘模块 - 调用商汤日日新 API 进行棋局分析
 */
class ReviewModule {
  constructor(apiEndpoint = '/api/review') {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * 生成复盘报告
   * @param {GomokuGame} game - 棋局对象
   * @param {number} humanPlayer - 人类执棋颜色 1=黑 2=白
   * @param {string} difficulty - AI难度
   * @returns {Promise<string>} 复盘分析文本
   */
  async analyze(game, humanPlayer, difficulty) {
    const cols = 'ABCDEFGHIJKLMNO';
    const humanName = humanPlayer === 1 ? '黑棋' : '白棋';
    const aiName = humanPlayer === 1 ? '白棋' : '黑棋';
    const winnerText = game.winner === humanPlayer ? '人类获胜' :
                       game.winner === 3 ? '平局' : 'AI获胜';

    // 精简棋谱文本（避免超长对局超 Token 导致 API 超时）
    let movesText = '';
    const history = game.history;
    if (history.length <= 30) {
      history.forEach((m, i) => {
        const name = m.player === 1 ? '黑' : '白';
        movesText += `${i + 1}.${name}${cols[m.col]}${m.row + 1} `;
      });
    } else {
      // 截取前 10 手 + 后 15 手
      for (let i = 0; i < 10; i++) {
        const m = history[i];
        const name = m.player === 1 ? '黑' : '白';
        movesText += `${i + 1}.${name}${cols[m.col]}${m.row + 1} `;
      }
      movesText += `... [中间省略${history.length - 25}手] ... `;
      for (let i = history.length - 15; i < history.length; i++) {
        const m = history[i];
        const name = m.player === 1 ? '黑' : '白';
        movesText += `${i + 1}.${name}${cols[m.col]}${m.row + 1} `;
      }
    }

    const prompt = `你是一位五子棋专业教练。请根据以下棋局进行点评复盘：
【局势参数】玩家:${humanName}, 结果:${winnerText}, 总手数:${history.length}, AI难度:${difficulty}
【棋谱路线】${movesText}

请按照以下四点重点拆解（控制在 400 字以内，使用 Markdown）：
1. **开局局势**：评估前几手选点得失
2. **关键胜负手**：找出败着或杀招转折点
3. **实用技术**：教 1 个针对本局暴露问题的五子棋技巧（如活三、冲四、防守要点）
4. **教练评价**：一句简短的亲切鼓励

回复要求：语气专业亲切，条理清晰。`;

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API 返回状态 ${response.status}`);
      }

      const data = await response.json();
      return data.content || '复盘分析暂时不可用，请稍后再试。';
    } catch (err) {
      console.error('复盘请求失败:', err);
      return `复盘请求出错: ${err.message}。请检查网络后重试。`;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewModule;
}
