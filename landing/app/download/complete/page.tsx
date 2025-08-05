"use client";

import Image from "next/image";
import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <Image
          src="/logo-light.svg"
          alt="Opus Logo"
          width={150}
          height={150}
          className="mb-8 mx-auto"
        />
        <h1 className="text-white text-2xl sm:text-4xl font-bold mb-4">
          Download Complete!
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base mb-8">
          Thank you for downloading Opus. Your download should start
          automatically. If it doesn't, please click the download button below.
        </p>

        <div className="space-y-4 space-x-4">
          <Link
            href="/download"
            className="inline-block w-full sm:w-auto px-6 py-3 bg-white text-black font-medium rounded hover:bg-gray-200 transition-all text-center active:scale-[98%]"
          >
            Download Again
          </Link>
          <button
            onClick={() => window.open("mailto:team@tryop.us", "_blank")}
            className="inline-block w-full sm:w-auto px-6 py-3 border border-zinc-700 text-white font-medium rounded hover:bg-zinc-900/50 transition-all text-center cursor-pointer active:scale-[98%]"
          >
            Get support
          </button>
        </div>
      </div>
    </div>
  );
}
