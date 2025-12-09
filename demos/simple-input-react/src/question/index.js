import React from "react";
import { PREFIX } from "./constants";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import Editor from "./components/editor";
import Hints from "./components/hints";
import TestCase from "./components/test-case";
import { get } from "lodash";

export default class Question {
  constructor(init, lrnUtils) {
    this.init = init;
    this.events = init.events;
    this.lrnUtils = lrnUtils;
    this.el = init.$el.get(0);
    // object to store React component states
    this.componentStates = { tips: [] };

    this.render().then(() => {
      this.registerPublicMethods();
      this.registerEventsListener();

      if (init.state === "review") {
        init.getFacade().disable();
      }

      let wrapper = document.getElementById(init.question.response_id);
      if (wrapper) {
        wrapper.classList.add(`${PREFIX}-wrapper`);
      }

      const stimulusCollection = wrapper.getElementsByClassName("lrn_stimulus");

      this.hintsMountPoint = document.createElement("div");
      this.hintsMountPoint.className = "lrn-custom-hints-container";

      // 3. Insert the Mount Point into the DOM (as a sibling)
      if (stimulusCollection.length > 0) {
        stimulusCollection[0].insertAdjacentElement(
          "afterend",
          this.hintsMountPoint
        );
      } else {
        // Fallback: append to main wrapper if no stimulus
        wrapper.appendChild(this.hintsMountPoint);
      }

      this.hintsRoot = ReactDOM.createRoot(this.hintsMountPoint);

      this.hintsRoot.render(
        <Hints
          renderComponent={this.renderComponent}
          componentState={this.componentStates}
          content={init.question}
          facade={this.init.getFacade()} // Assuming your JSON has a 'hints' field
        />
      );

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
      this.renderTestCases();
    });
  }

  renderComponent(options = {}) {
    const { reactRoot, init } = this;
    const { state, question, response } = init;

    // manage React component states
    Object.assign(this.componentStates, options);

    const resetState = this.componentStates.resetState || null;

    reactRoot.render(
      <Editor
        state={state}
        maxLength={question.max_length}
        responseValue={response || ""}
        disabled={!!this.componentStates.disabled}
        onChange={this.onValueChange}
        requestToResetValidationUIState={this.resetValidationUIState}
        validationUIState={this.componentStates.validationUIState}
        resetState={resetState}
        testCases={question.test_cases}
        tips={this.componentStates.tips}
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

  renderTestCases() {
    const question = this.init.question.test_cases.map((testCase) => testCase);
    this.lrnComponents.suggestedAnswersList.setAnswers(
      question.map((result, index) => ({
        label: ReactDOMServer.renderToStaticMarkup(
          <TestCase
            result={result}
            index={index}
            formatTestCase={this.formatTestCase}
          />
        ),
      }))
    );
  }

  onValidateListener() {
    const { init, el } = this;
    const facade = init.getFacade();
    const events = init.events;
    const responseInputElement = el.querySelector(".lrn_response_input");

    events.on("validate", (options) => {
      const { showCorrectAnswers } = options || {};
      const validatedTestCases = facade.isValid();
      const isCorrect = validatedTestCases.every(
        (testCase) => testCase.correct
      );

      console.log(validatedTestCases);

      if (isCorrect) {
        responseInputElement.classList.add("lrn_correct");
      } else {
        responseInputElement.classList.add("lrn_incorrect");
      }

      this.renderComponent({
        validationUIState: isCorrect ? "correct" : "incorrect",
      });

      if (showCorrectAnswers) {
        // const correctAnswer = get(init.question, "valid_response.value");
        this.lrnComponents.suggestedAnswersList.setAnswers(
          validatedTestCases.map((result, index) => ({
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
                ${result.error ? result.error : result.result}
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
