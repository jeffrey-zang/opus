import { execPromise } from "../utils";

export interface OpenUriReturnType {
  type: "uri";
  error: string;
}
export async function openUri(body: string): Promise<OpenUriReturnType> {
  const uri = body;
  const { stderr } = await execPromise(`open -g ${uri}`);
  return { type: "uri", error: stderr };
}
