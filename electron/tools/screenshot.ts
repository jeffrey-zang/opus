import { Jimp } from "jimp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execPromise } from "../utils";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function takeScreenshot(width: number, height: number) {
  // const tmpPath = path.join(os.tmpdir(), "temp_screenshot.png");
  const tmpPath = path.join(__dirname, `${Date.now()}-screenshot.png`);

  console.time("screenshot-and-process");
  await execPromise(`screencapture -C -x "${tmpPath}"`);
  const image = await Jimp.read(tmpPath);
  image.resize({ w: width, h: height });
  console.log(image.width, image.height);

  const dotColor = 0x00ff00ff; // red with full alpha
  const radius = 5;

  for (let y = 0; y < image.bitmap.height; y += 100) {
    for (let x = 0; x < image.bitmap.width; x += 100) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = dx * dx + dy * dy;
          if (dist <= radius * radius) {
            image.setPixelColor(dotColor, x + dx, y + dy);
          }
        }
      }
    }
  }

  const img = await image.getBase64("image/png");
  fs.unlink(tmpPath, (err) => {
    if (err) console.error(err);
  });
  console.timeEnd("screenshot-and-process");
  return img;
}
