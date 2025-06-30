import { run } from "@openai/agents";
import { scriptsAgent } from "../ai";
import { execPromise } from "../utils";
import { writeFile } from "fs";

export async function generateScript(prompt: string, img: string) {
  console.time("scriptsAgent-run");
  const scriptOutput = (
    await run(scriptsAgent, [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
          { type: "input_image", image: img },
        ],
      },
    ])
  ).state._currentStep;
  console.timeEnd("scriptsAgent-run");
  if (scriptOutput?.type != "next_step_final_output") return;
  return scriptOutput?.output;
}

export async function runScript(script: string) {
  console.log(script);
  console.time("writeFile-script");
  writeFile("./temp/script.scpt", script, (err) => {
    if (err) console.error(err);
    console.timeEnd("writeFile-script");
  });
  console.time("run-applescript");
  const { stdout, stderr } = await execPromise(`osascript ./temp/script.scpt`);
  console.timeEnd("run-applescript");
  return { stdout, stderr };
}
