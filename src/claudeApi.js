function parseClaudeAnalysisJsonText(raw) {
  if (raw == null || typeof raw !== "string") return null;
  let t = raw.trim();
  const fenced = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(t);
  if (fenced) t = fenced[1].trim();
  const tryParse = (s) => {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object") {
        const str = (v) =>
          v == null ? "" : typeof v === "string" ? v : String(v);
        return {
          whatChanged: str(o.whatChanged),
          impact: str(o.impact),
          likelyCause: str(o.likelyCause),
          suggestedAction: str(o.suggestedAction),
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  const direct = tryParse(t);
  if (direct) return direct;
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    const inner = tryParse(t.slice(i, j + 1));
    if (inner) return inner;
  }
  return null;
}

const CHAT_SYSTEM_PROMPT = `You are a data copilot for Unlockdb. 
You help data engineers understand data changes 
and their impact. 

You have access to the current data context 
provided. Answer questions directly and 
practically. Keep answers concise (2-4 sentences 
max). Focus on actionable insights.

If asked about something outside the data context, 
say: 'I can only answer questions about the 
current dataset and its changes.'

If asked about table naming, you can suggest 
better names based on the table's content, 
schema location, and naming conventions. 
Prefer lowercase_with_underscores format.

Never make up data that isn't in the context.`;

const EXPLAIN_SYSTEM_PROMPT = `You are a data change analyst for Unlockdb. 
You analyze data changes and explain their impact clearly 
and concisely. Always respond in this exact JSON format:
{
  "whatChanged": "one sentence describing the change",
  "impact": "one sentence about business/technical impact",
  "likelyCause": "one sentence about probable root cause",
  "suggestedAction": "one concrete next step"
}
Be specific, practical, and avoid generic answers. 
Use the data context provided.`;

export async function askClaude(prompt, context, options = {}) {
  const mode = options.mode === "chat" ? "chat" : "explain";
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return mode === "chat"
      ? ""
      : "AI analysis unavailable — API key not configured.";
  }

  const contextBlock =
    mode === "chat"
      ? String(context ?? "").slice(0, 6000)
      : JSON.stringify(context ?? {}, null, 2);

  const userContent =
    mode === "chat"
      ? `Question:\n${prompt}\n\nDataset context:\n${contextBlock}`
      : `Analyze this data change:

${prompt}

Data context:
${contextBlock}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: mode === "chat" ? 512 : 1024,
      system: mode === "chat" ? CHAT_SYSTEM_PROMPT : EXPLAIN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  if (mode === "chat") {
    return text.trim();
  }

  const parsed = parseClaudeAnalysisJsonText(text);
  if (parsed) return parsed;

  return {
    whatChanged: text.trim().slice(0, 4000),
    impact: "",
    likelyCause: "",
    suggestedAction: "",
  };
}
