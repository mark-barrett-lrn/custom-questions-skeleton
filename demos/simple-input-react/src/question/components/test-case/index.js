import React from "react";

export default function TestCase({ result, index, formatTestCase }) {
  if (!result.correct) {
    return (
      <div>
        <span>Case {index + 1}</span>
      </div>
    );
  }

  return (
    <div>
      <strong style={{ color: result.correct ? "green" : "red" }}>
        {result.correct ? "✅" : "❌"} Case {index + 1}
      </strong>
      <br />
      <small>Input</small>
      <br />
      <code>{formatTestCase(result.input)}</code>
      <br />
      <small>Output</small>
      <br />
      <span style={{ color: result.correct ? "green" : "red" }}>
        {result.result}
      </span>
      <br />
      <small>Expected</small>
      <br />
      <span style={{ color: "green" }}>{result.output}</span>
    </div>
  );
}
