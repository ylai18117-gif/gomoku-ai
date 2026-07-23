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
    const winnerText = game.winner === humanPlayer ? '你赢了' :
                       game.winner === 3 ? '平局' : 'AI赢了';

    // 构建棋谱文本
    let movesText = '';
    game.history.forEach((m, i) => {
      const name = m.player === 1 ? '黑' : '白';
      const mark = m.player === humanPlayer ? '(你)' : '(AI)';
      movesText += `第${i + 1}手: ${name}${mark} ${cols[m.col]}${m.row + 1}\n`;
    });

    const prompt = `你是一位五子棋大师教练，请根据以下棋局进行复盘教学。

【棋局信息】
- 棋盘大小: ${game.size}×${game.size}
- 你执: ${humanName}
- AI执: ${aiName}
- AI难度: ${difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难'}
- 结果: ${winnerText}
- 总手数: ${game.history.length}

【完整棋谱】
${movesText}

【最终棋盘】
${game.boardToText()}

请你以教练身份进行复盘，要求：
1. **开局分析**（前6手）：评价你的开局策略，是否合理，有无更好选择
2. **中盘关键手**：找出2-3个关键转折点，分析你的好棋和失误
3. **战术教学**：结合本局教1-2个实用五子棋技巧（如活三、冲四、做杀、VCF等）
4. **改进建议**：具体指出哪几步可以改进，应该怎么走
5. **鼓励总结**：用简短的话总结你的表现，给予鼓励

请用中文回复，语气亲切专业，像一位耐心的棋类教练。使用markdown格式，重点用加粗标注。回复控制在500字以内。`;

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data.content || '复盘分析暂时不可用，请稍后再试。';
    } catch (err) {
      console.error('复盘请求失败:', err);
      return `复盘请求出错: ${err.message}。请检查网络连接后重试。`;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewModule;
}
