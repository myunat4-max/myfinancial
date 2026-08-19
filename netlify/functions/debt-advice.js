// Netlify Function: /.netlify/functions/debt-advice
// 作用:接收前端发来的负债与收入数据,调用 DeepSeek API 生成还款优先级建议。
// API Key 放在这里(服务器端环境变量),不会暴露给浏览器。
//
// 部署前需要在 Netlify 后台 Site settings → Environment variables 里添加:
//   DEEPSEEK_API_KEY = 你的 DeepSeek API Key

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "服务器未配置 DEEPSEEK_API_KEY 环境变量,请在 Netlify 后台添加后重新部署。" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "请求格式错误" }) };
  }

  const { debts = [], income = {} } = payload;

  const prompt = `你是一位说话轻松、务实的家庭财务顾问朋友,不要用正式报告腔调。
下面是一个家庭当前的负债清单(JSON数组,每项包含名称、归属人、年利率、剩余金额、月还款):
${JSON.stringify(debts, null, 2)}

家庭收入情况:
${JSON.stringify(income, null, 2)}

请用中文给出:
1. 简短总结当前负债压力(1-2句话,语气温和,不要制造焦虑)
2. 还款优先级建议:按1、2、3列出接下来应该优先多还哪几笔(说明理由,比如利率高、快还完了有成就感、影响个人征信等角度都可以综合考虑)
3. 一句鼓励的话

控制在300字以内,像朋友聊天一样说,不要用"报告""综上所述"这种词。`;

  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "DeepSeek 调用失败: " + errText }) };
    }

    const data = await resp.json();
    const advice = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "AI 没有返回内容,请稍后重试。";

    return { statusCode: 200, body: JSON.stringify({ advice }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "请求异常: " + e.message }) };
  }
};
