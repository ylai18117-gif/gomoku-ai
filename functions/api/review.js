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

    // 调用商汤日日新 API（带 429 Rate-Limit 自动重试）
    let apiResponse;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      apiResponse = await fetch('https://token.sensenova.cn/v1/chat/completions', {
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

      if (apiResponse.status === 429 && attempts < maxAttempts) {
        // 触发 TPM/RPM 限流，延迟 1.5 秒后重试
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      break;
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('商汤 API 错误:', apiResponse.status, errText);
      if (apiResponse.status === 429) {
        return jsonResponse({ content: '⏳ 当前 API 触发了频次速率限制 (429 TPM Limit)，请等待几秒后再试。' });
      }
      return jsonResponse({ error: `AI 服务错误 (${apiResponse.status}): ${errText}` }, 502);
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content ||
                    data.choices?.[0]?.text ||
                    data.data?.choices?.[0]?.message?.content ||
                    (typeof data.content === 'string' ? data.content : null);

    if (!content) {
      console.error('API 未能解析到有效文本:', JSON.stringify(data));
      return jsonResponse({ content: 'AI 复盘思考超时或未能生成响应，请稍后再试。' });
    }

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
