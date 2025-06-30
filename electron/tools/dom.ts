import { execPromise } from "../utils";

export async function getDOM(frontApp: string) {
  if (frontApp === "Safari") {
    const jsToInject = `function serializeDOM(node) { if (!node || node.nodeType !== 1) return null; const children = [...node.children].map(serializeDOM).filter(Boolean); return { tag: node.tagName, id: node.id || null, class: node.className || null, role: node.getAttribute('role') || null, text: node.innerText?.trim().slice(0, 100) || null, clickable: typeof node.onclick === 'function' || ['A', 'BUTTON'].includes(node.tagName), children: children.length ? children : null }; } JSON.stringify(serializeDOM(document.body));`;
    const { stdout: safariDOM } = await execPromise(
      `osascript -e 'tell application "Safari" to do JavaScript "${jsToInject.replace(
        /"/g,
        '\\"',
      )}"'`,
      { maxBuffer: 1024 * 1024 * 50 }, // 50MB
    );
    return safariDOM;
  }
  return "";
}
