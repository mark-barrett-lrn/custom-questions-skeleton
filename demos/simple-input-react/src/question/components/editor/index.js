import React, { useState, useEffect } from "react";
import classnames from "classnames";
import Editor, { useMonaco } from "@monaco-editor/react";
export default function SimpleInput(props) {
  const {
    state,
    maxLength,
    disabled,
    responseValue,
    validationUIState,
    requestToResetValidationUIState,
    onChange,
    resetState,
    testCases,
    tips
  } = props;
  const isReviewState = state === "review";
  const [inputValue, setInputValue] = useState(responseValue);
  console.log(tips)

  useEffect(() => {
    // reset input value when resetState is 'reset'
    if (resetState === "reset") {
      setInputValue("");
    }
  }, [resetState]);

  const onInputChange = (e) => {
    if (!isReviewState) {
      const newValue = e;

      setInputValue(newValue);
      onChange(newValue);
    }
  };
  const onInputFocus = () => {
    if (!isReviewState) {
      requestToResetValidationUIState();
    }
  };
  const resValidatedClassNames = classnames(
    {
      lrn_correct: validationUIState === "correct",
      lrn_incorrect: validationUIState === "incorrect",
    },
    "lrn_textinput"
  );

  const getDefaultValue = () => {
    // The default value for the editor is a single function called "solution"
    // that takes params based on the first test cases args
    return `function solution(${Object.keys(testCases[0].input).join(", ")}) {
  // enter your solution here
}`;
  };

  // useEffect(() => {
  //   setInputValue(getDefaultValue());
  // }, []);

  const monaco = useMonaco();
  const [editor, setEditor] = useState(null); // 1. Create state for the editor

  useEffect(() => {
    // 2. Wait for BOTH monaco and the editor instance to be ready
    if (!monaco || !editor) return;

    // 3. Define the command that runs when you click the lens
    // We use the editor instance to add a command, which returns a unique ID string.
    const commandId = editor.addCommand(0, () => {
      alert("You clicked the AI suggestion!");
    });

    const lensesTips = Array.isArray(tips) ? tips.map(tip => ({
      range: {
        startLineNumber: tip.line,
        startColumn: 1,
        endLineNumber: tip.line,
        endColumn: 1,
      },
      command: {
        id: commandId,
        title: `⚠️ AI Tip: ${tip.tip}`,
      },
    })) : [];

    console.log(lensesTips)

    // 4. Register the Code Lens Provider
    const provider = monaco.languages.registerCodeLensProvider("javascript", {
      provideCodeLenses: function (model, token) {
        return {
          lenses: lensesTips
          ,
          dispose: () => {},
        };
      },
      resolveCodeLens: function (model, codeLens, token) {
        return codeLens;
      },
    });

    // Cleanup when component unmounts
    return () => {
      provider.dispose();
    };
  }, [monaco, editor, tips]); // Re-run this effect when editor is set

  return (
    <div className="lrn_widget lrn_shorttext">
      <div className={resValidatedClassNames}>
        <Editor
          height="40vh"
          theme="vs-dark"
          defaultLanguage="javascript"
          defaultValue={getDefaultValue()}
          onChange={onInputChange}
          onFocus={onInputFocus}
          disabled={isReviewState || disabled}
          onMount={(editorInstance) => setEditor(editorInstance)}
        />
      </div>
    </div>
  );
}
