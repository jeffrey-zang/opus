"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type OS = "macos" | "windows" | "linux";

export default function DownloadComponent() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OS>("macos");

  const handleDownload = (os: OS) => {
    try {
      if (os !== "macos") {
        return;
      }

      setIsDownloading(true);
      setError(null);

      window.location.href = "/download/Opus.dmg";

      router.push("/download/complete");
    } catch (error) {
      console.error("Download error:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const OSButton = ({ os, label }: { os: OS; label: string }) => {
    const isDisabled = os !== "macos";
    const isSelected = selectedOS === os;

    const getOSLogo = () => {
      switch (os) {
        case "macos":
          return (
            <Image
              src="/images/apple.svg"
              alt="Apple Logo"
              width={24}
              height={24}
            />
          );
        case "windows":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
            </svg>
          );
        case "linux":
          return (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 17.5c-2.2 0-4-1.8-4-4 0-.3.2-.5.5-.5s.5.2.5.5c0 1.7 1.3 3 3 3 .3 0 .5.2.5.5s-.2.5-.5.5zm6.6-1.4c-.2.2-.5.2-.7 0l-3.5-3.5c-.2-.2-.2-.5 0-.7.2-.2.5-.2.7 0l3.5 3.5c.2.2.2.5 0 .7zm-10.7-10.7c-.2.2-.5.2-.7 0-.2-.2-.2-.5 0-.7l3.5-3.5c.2-.2.5-.2.7 0 .2.2.2.5 0 .7l-3.5 3.5z" />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <button
        onClick={() => !isDisabled && setSelectedOS(os)}
        className={`flex items-center justify-between w-full p-4 rounded-lg border transition-all ${
          isSelected
            ? "border-white/20 bg-white/5 cursor-pointer active:scale-[98%]"
            : isDisabled
            ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
            : "border-zinc-800 hover:border-white/10 hover:bg-white/[0.02]"
        }`}
        disabled={isDisabled}
      >
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-lg ${
              isDisabled ? "bg-zinc-900" : "bg-white/5"
            } flex items-center justify-center mr-3`}
          >
            {getOSLogo()}
          </div>
          <div className="text-left">
            <div className="font-medium text-white">{label}</div>
            <div className="text-xs text-zinc-500">
              {isDisabled
                ? "Coming soon"
                : os === "macos"
                ? "Apple Silicon (.dmg)"
                : os === "windows"
                ? "Windows 10+"
                : "Linux (64-bit)"}
            </div>
          </div>
        </div>
        {isDisabled && (
          <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400">
            Soon
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-zinc-950">
      <div className="w-full max-w-md mx-auto text-center">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-24 h-24 relative mb-4">
            <Image
              src="/logo-light.svg"
              alt="Opus Logo"
              fill
              className="object-contain"
            />
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Download Opus</h1>
          <p className="text-zinc-400 text-sm">
            Select your platform to download
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <OSButton os="macos" label="Download for macOS" />
          <OSButton os="windows" label="Download for Windows" />
          <OSButton os="linux" label="Download for Linux" />
        </div>

        {error && (
          <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded-lg border border-red-800/50 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={() => handleDownload(selectedOS)}
          disabled={isDownloading || selectedOS !== "macos"}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            isDownloading
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : selectedOS === "macos"
              ? "bg-white text-black hover:bg-gray-200 cursor-pointer active:scale-[98%]"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {isDownloading ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Downloading...
            </div>
          ) : (
            `Download for ${
              selectedOS === "macos"
                ? "macOS"
                : selectedOS === "windows"
                ? "Windows"
                : "Linux"
            }`
          )}
        </button>

        <div className="text-center mt-2">
          <a
            href="/"
            className="inline-flex items-center text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
}
