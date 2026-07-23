/**
 * Cloudflare Pages Function - 商汤日日新 API 代理
 * POST /api/review
 * 密钥存在 Cloudflare 环境变量中，前端不可见
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return jsonResponse({ error: '缺少 prompt 参数' }, 400);
    }

    const apiKey = env.SENSENOVA_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: '服务端未配置 API 密钥' }, 500);
    }

    // 调用商汤日日新 API（OpenAI 兼容格式）
    const apiResponse = await fetch('https://api.sensenova.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的五子棋教练，擅长复盘分析和教学。请用中文回复。'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('商汤 API 错误:', apiResponse.status, errText);
      return jsonResponse({ error: `AI 服务错误: ${apiResponse.status}` }, 502);
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content || '未能获取分析结果';

    return jsonResponse({ content });

  } catch (err) {
    console.error('API 代理错误:', err);
    return jsonResponse({ error: `服务异常: ${err.message}` }, 500);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
