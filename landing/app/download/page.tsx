import { notFound } from "next/navigation";
import path from "path";
import fs from "fs";
import DownloadComponent from "./DownloadComponent";

export default function DownloadPage() {
  const filePath = path.join(process.cwd(), "public", "download", "Opus.dmg");

  if (!fs.existsSync(filePath)) {
    console.error("DMG file not found at:", filePath);
    notFound();
  }

  return <DownloadComponent />;
}
