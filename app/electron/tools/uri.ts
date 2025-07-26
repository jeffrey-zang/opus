import { ExecException } from "node:child_process";
import { execPromise } from "../utils/utils";

export interface OpenUriReturnType {
  type: "uri";
  error: string;
}
export async function openUri(body: string): Promise<OpenUriReturnType> {
  const uri = body;
  try {
    await execPromise(`open -g ${uri}`);
    return { type: "uri", error: "" };
  } catch (error) {
    const { stderr } = error as ExecException;
    return { type: "uri", error: stderr ?? "" };
  }
}
