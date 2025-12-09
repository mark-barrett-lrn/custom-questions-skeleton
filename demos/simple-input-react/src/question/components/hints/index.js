import React, { useState } from "react";

export default function Hints({renderComponent, componentState, content, facade}) {
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const prompt = `
You are assisting someone working on a Leetcode-style coding problem. 
They are stuck and have some code written already.

Your task:
- Look at the problem description and their current code.
- Provide guidance as **short hints** for lines that might need attention.
- Do NOT explain the full solution, do NOT give exact fixes, do NOT write full algorithms.
- Hints should **only suggest what to think about or what might be going wrong**, without telling exactly what to do.
- Return your response strictly as JSON in this format:

{
    "comment": "general guidance comment (brief)",
    "tips": [
        {
            "line": <line number where attention is needed>,
            "tip": "very short hint, suggest something to consider, don't give exact solution"
        }
    ]
}

- Include only relevant lines.
- Keep JSON concise and parsable.
`;


  const problem = content.stimulus

  const callLLM = () => {
    setLoading(true);
    setHint(""); // clear previous hint

    const apiKey = "NONE"

    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `
              Problem: ${problem}
              User's code:
              ${facade.getResponse().value}
          ` }
        ],
      }),
    })
      .then(res => res.json())
      .then(data => {
        let raw = data.choices[0].message.content;
        raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(raw)
        setHint(parsed.comment);
        componentState['tips'] = parsed.tips
        renderComponent()
      })
      .catch(err => {
        console.error(err);
        setHint("Failed to get hint");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <button onClick={callLLM} disabled={loading}>
        {loading ? "Loading..." : "I need help"}
      </button>
      {hint && (
        <div style={{ marginTop: "10px", fontWeight: "bold" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
