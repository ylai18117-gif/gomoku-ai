# 五子棋 AI 训练 🎯

与 AI 对弈五子棋，赛后由 AI 教练复盘分析，教你实战技巧。

## 功能

- 🎮 **人机对弈**：可选先后手，三档难度（简单/中等/困难）
- 🧠 **AI 引擎**：Minimax + Alpha-Beta 剪枝，棋型评估
- 📋 **AI 复盘**：对局结束后调用商汤日日新大模型分析棋局
- 📱 **响应式**：支持手机和桌面浏览器

## 技术栈

- 前端：原生 HTML/CSS/JS + Canvas
- AI 对弈：本地 Minimax 算法（无需网络）
- AI 复盘：商汤日日新 deepseek-v4-flash（通过 Cloudflare Pages Function 代理）
- 部署：Cloudflare Pages

## 本地开发

```bash
npm run dev
# 访问 http://localhost:8788
```

## 部署到 Cloudflare Pages

1. 推送仓库到 GitHub
2. Cloudflare Pages 关联仓库，构建设置：
   - 输出目录：`public`
   - 无需构建命令
3. 设置环境变量：`SENSENOVA_API_KEY`

## 环境变量

| 变量 | 说明 |
|------|------|
| `SENSENOVA_API_KEY` | 商汤日日新 API 密钥（Cloudflare Pages 设置中配置） |
