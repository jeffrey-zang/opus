import { AgentInputItem, run } from "@openai/agents";
import { actionAgent } from "./ai";
import { logWithElapsed } from "./utils";
import { ActionResult, Element } from "./types";
import * as fs from "node:fs";
import * as path from "node:path";

export async function runActionAgent(
  appName: string,
  userPrompt: string,
  clickableElements: Element[],
  history: AgentInputItem[],
  screenshotBase64?: string,
  stepFolder?: string,
) {
  logWithElapsed("runActionAgent", `Running action agent for app: ${appName}`);
  let parsedClickableElements = "";
  for (let i = 0; i < clickableElements.length; i++) {
    const element: Element = clickableElements[i];
    let roleOrSubrole = "";
    if (element.AXSubrole && element.AXSubrole !== "") {
      roleOrSubrole = element.AXSubrole + " ";
    } else if (element.AXRole && element.AXRole !== "") {
      roleOrSubrole = element.AXRole + " ";
    }
    parsedClickableElements +=
      `${element.id} ${roleOrSubrole}${
        element.AXTitle ? `${element.AXTitle.trim()} ` : ""
      }${element.AXValue ? `${element.AXValue.trim()} ` : ""}${
        element.AXHelp ? `${element.AXHelp.trim()} ` : ""
      }${element.AXDescription ? `${element.AXDescription.trim()} ` : ""}` +
      "\n";
  }

  // let parsedHistory = "";
  // for (const h of history) {
  //   switch (h.type) {
  //     case "click": {
  //       const e = h.element;
  //       if (e) {
  //         parsedHistory +=
  //           `click ${e.id} ${e.AXRole !== "" ? `${e.AXRole} ` : ""}${
  //             e.AXTitle !== "" ? `${e.AXTitle} ` : ""
  //           }${e.AXValue !== "" ? `${e.AXValue} ` : ""}${
  //             e.AXHelp !== "" ? `${e.AXHelp} ` : ""
  //           }${e.AXDescription !== "" ? `${e.AXDescription} ` : ""}`.trim() +
  //           "\n";
  //       }
  //       break;
  //     }
  //     case "key": {
  //       parsedHistory += "key " + h.keyString + "\n";
  //       break;
  //     }
  //   }
  // }

  const contentText =
    `You are operating on the app: ${appName}.\n\n` +
    `User prompt (the task you must complete): ${userPrompt}\n\n` +
    `Here is a list of clickable elements:\n${parsedClickableElements}\n\n`;
  //+
  // `Action history so far:\n${
  //   parsedHistory
  //     ? parsedHistory
  //     : "No actions have been completed yet (this is the first action)."
  // }`;

  const agentInput: AgentInputItem[] = [
    ...history,
    {
      role: "user",
      content: [
        { type: "input_text" as const, text: contentText },
        ...(screenshotBase64
          ? [
              {
                type: "input_image" as const,
                image: `data:image/png;base64,${screenshotBase64}`,
              },
            ]
          : []),
      ],
    },
  ];

  if (stepFolder) {
    fs.writeFileSync(path.join(stepFolder, "agent-prompt.txt"), contentText);
    fs.writeFileSync(
      path.join(stepFolder, "fullPrompt.json"),
      JSON.stringify(agentInput),
    );
    logWithElapsed("runActionAgent", `Saved agent-prompt.txt`);
  }

  const actionResult = await run(actionAgent, agentInput);
  logWithElapsed(
    "runActionAgent",
    `Action agent result: ${
      actionResult.state._currentStep &&
      "output" in actionResult.state._currentStep
        ? actionResult.state._currentStep.output.trim()
        : undefined
    }`,
  );
  return actionResult.state._currentStep &&
    "output" in actionResult.state._currentStep
    ? actionResult.state._currentStep.output.trim()
    : undefined;
}
