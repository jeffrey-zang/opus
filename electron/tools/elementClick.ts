import { execPromise } from "../utils";

export interface ClickableItem {
  id: number;
  role: string;
  title: string;
  description: string;
}

export async function fetchAllClickableItems(): Promise<ClickableItem[]> {
  try {
    const { stdout } = await execPromise(
      "./swift/accessibility.swift json-list",
    );
    if (!stdout) {
      return [];
    }
    return JSON.parse(stdout) as ClickableItem[];
  } catch (error) {
    console.error("Failed to fetch clickable items:", error);
    return [];
  }
}

export async function clickItem(id: number): Promise<{
  success: boolean;
  clicked_element?: { id: number; title: string };
  error?: string;
}> {
  try {
    const { stdout } = await execPromise(
      `./swift/accessibility.swift click ${id}`,
    );
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Failed to click item ${id}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    try {
      return JSON.parse(errorMessage);
    } catch {
      return { success: false, error: errorMessage };
    }
  }
}
