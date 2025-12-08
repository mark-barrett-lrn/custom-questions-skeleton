import { PREFIX } from "./constants";
import React from "react";
import ReactDOM from "react-dom/client";
import SimpleInput from "./components/simpleInput";
import { get } from "lodash";

export default class Question {
  constructor(init, lrnUtils) {
    this.init = init;
    this.events = init.events;
    this.lrnUtils = lrnUtils;
    this.el = init.$el.get(0);
    // object to store React component states
    this.componentStates = {};

    this.render().then(() => {
      this.registerPublicMethods();
      this.registerEventsListener();

      if (init.state === "review") {
        init.getFacade().disable();
      }

      init.events.trigger("ready");
    });
  }

  render() {
    const { el, lrnUtils } = this;

    // Render default layout for the question
    el.innerHTML = `
            <div class="${PREFIX} lrn-response-validation-wrapper">
                <div class="lrn_response_input"></div>            
                <div class="${PREFIX}-checkAnswer-wrapper"></div>
                <div class="${PREFIX}-suggestedAnswers-wrapper"></div>
            </div>
        `;

    // Optional - Render optional Learnosity components like Check Answer Button, Suggested Answers List
    // first before rendering your question's components
    return Promise.all([
      lrnUtils.renderComponent(
        "SuggestedAnswersList",
        el.querySelector(`.${PREFIX}-suggestedAnswers-wrapper`)
      ),
      lrnUtils.renderComponent(
        "CheckAnswerButton",
        el.querySelector(`.${PREFIX}-checkAnswer-wrapper`)
      ),
    ]).then(([suggestedAnswersList]) => {
      // suggestedAnswersList is a wrapped function to render suggested answer
      this.lrnComponents = {
        suggestedAnswersList,
      };

      const reactDomContainer = el.querySelector(".lrn_response_input");

      this.reactRoot = ReactDOM.createRoot(reactDomContainer);
      this.renderComponent();
    });
  }

  renderComponent(options = {}) {
    const { reactRoot, init } = this;
    const { state, question, response } = init;

    // manage React component states
    Object.assign(this.componentStates, options);

    const resetState = this.componentStates.resetState || null;

    reactRoot.render(
      <SimpleInput
        state={state}
        maxLength={question.max_length}
        responseValue={response || ""}
        disabled={!!this.componentStates.disabled}
        onChange={this.onValueChange}
        requestToResetValidationUIState={this.resetValidationUIState}
        validationUIState={this.componentStates.validationUIState}
        resetState={resetState}
        testCases={question.test_cases}
      />
    );
  }

  onValueChange = (value) => {
    // manage the state when question is reset
    if (this.componentStates.resetState) {
      this.renderComponent({ resetState: "attemptedAfterReset" });
    }
    this.events.trigger("changed", value);
  };

  resetValidationUIState = () => {
    this.lrnComponents.suggestedAnswersList.reset();
    this.renderComponent({
      validationUIState: "",
    });
  };

  /**
   * Add public methods to the created question instance that is accessible during runtime
   *
   * Example: questionsApp.question('my-custom-question-response-id').myNewMethod();
   */
  registerPublicMethods() {
    const { init } = this;
    const facade = init.getFacade();

    // Attach the methods you want on this object
    facade.disable = () => {
      this.renderComponent({ disabled: true });
    };
    facade.enable = () => {
      this.renderComponent({ disabled: false });
    };

    facade.resetResponse = () => {
      // reset the value of response
      this.events.trigger("resetResponse");

      // reset other states if you need
      // ...

      // re-render the component, manage the 'reset' state by yourself
      this.renderComponent({ resetState: "reset" });
    };
  }

  /**
   * add any events listener
   *
   * Example: onValidateHandler() to listen to events.on('validate')
   */
  registerEventsListener() {
    this.onValidateListener();
  }

  checkTestCase(testCase, responseValue) {
    try {
      // 1. Prepare the code
      // We append "; return functionName;" so we can extract the function handle
      // regardless of how the user defined it (var, const, or function keyword)
      const executableCode = `${responseValue}; return solution;`;

      console.log(executableCode);

      // 2. Instantiate
      const createFunc = new Function(executableCode);
      const userFunc = createFunc();

      // 3. Prepare Arguments (Deep Copy to prevent mutation issues)
      const args = Object.keys(testCase.input).map((key) => {
        // Handle cases where the key might not exist in the object safely
        const val = testCase.input[key];
        return typeof val === "object" && val !== null
          ? JSON.parse(JSON.stringify(val))
          : val;
      });

      // 4. EXECUTE & CAPTURE RETURN VALUE
      // This is the key change: we store the result of the call
      const result = userFunc(...args);

      return {
        correct: result == testCase.output,
        // defines if the execution was successful or not
        success: true,
        result: result,
        input: testCase.input,
        output: testCase.output,
      };
    } catch (error) {
      return {
        correct: false,
        success: false,
        input: testCase.input,
        output: testCase.output,
        error: error.toString(), // e.g. "ReferenceError: maxSubArray is not defined"
      };
    }
  }

  formatTestCase(testCaseObj) {
    // We use Object.entries to get pairs of [key, value]
    // e.g., [['nums', [1,2,3]], ['m', 3]]
    return Object.entries(testCaseObj)
      .map(([key, value]) => {
        // JSON.stringify handles arrays, strings, and booleans perfectly
        let formattedValue = JSON.stringify(value);

        // Edge case: JavaScript turns 2.0 into 2 automatically.
        // If you strictly need to show ".0" for floats that look like integers:
        if (
          typeof value === "number" &&
          Number.isInteger(value) &&
          String(value).includes(".")
        ) {
          formattedValue = value.toFixed(1);
        }

        return `${key} = ${formattedValue}`;
      })
      .join("\n"); // Join them with a new line for a clean list
  }

  onValidateListener() {
    const { init } = this;
    const facade = init.getFacade();
    const events = init.events;

    events.on("validate", (options) => {
      const { showCorrectAnswers } = options || {};
      const isValid = facade.isValid(); // true is correct, false incorrect
      const savedResponse = facade.getResponse();

      const results = init.question.test_cases.map((testCase) =>
        this.checkTestCase(testCase, savedResponse.value)
      );

      this.renderComponent({
        validationUIState: isValid ? "correct" : "incorrect",
      });

      if (showCorrectAnswers) {
        // const correctAnswer = get(init.question, "valid_response.value");
        this.lrnComponents.suggestedAnswersList.setAnswers(
          results.map((result, index) => ({
            label: `
              <div>
                <strong style="color: ${result.correct ? "green" : "red"}">${
              result.correct ? "✅" : "❌"
            } Case ${index + 1}</strong><br/>
                <small>Input</small><br/>
                <code>
                ${this.formatTestCase(result.input)}
                </code><br/>
                <small>Output</small><br/>
                <span style="color: ${result.correct ? "green" : "red"};">
                ${result.result}
                </span><br/>
                <small>Expected</small><br/>
                <span style="color: green;">
                ${result.output}
                </span>
              </div>
            `,
          }))
        );
      }
    });
  }
}
