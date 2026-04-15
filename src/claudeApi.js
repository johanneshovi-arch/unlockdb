export async function askClaude(prompt, context) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return "AI analysis unavailable — API key not configured.";
  }

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
      max_tokens: 1024,
      system: `You are a data change analyst for Unlockdb. 
You analyze data changes and explain their impact clearly 
and concisely. Always respond in this exact JSON format:
{
  "whatChanged": "one sentence describing the change",
  "impact": "one sentence about business/technical impact",
  "likelyCause": "one sentence about probable root cause",
  "suggestedAction": "one concrete next step"
}
Be specific, practical, and avoid generic answers. 
Use the data context provided.`,
      messages: [
        {
          role: "user",
          content: `Analyze this data change:

${prompt}

Data context:
${JSON.stringify(context, null, 2)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  try {
    return JSON.parse(text);
  } catch {
    return {
      whatChanged: text,
      impact: "See above",
      likelyCause: "Unknown",
      suggestedAction: "Review the change manually",
    };
  }
}
