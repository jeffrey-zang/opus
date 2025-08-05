"use client";

import Image from "next/image";
import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Image
        src="/logo-light.svg"
        alt="Opus Logo"
        width={150}
        height={150}
        className="mb-8 mx-auto"
      />

      <div className="max-w-md w-full text-center">
        <h1 className="text-white text-2xl sm:text-4xl font-bold mb-4">
          Download Error
        </h1>
        <div className="bg-red-900/20 text-red-400 border border-red-700 rounded p-4 mb-6">
          <p className="text-sm sm:text-base">
            We're sorry, but there was an error processing your download
            request.
          </p>
        </div>
        <p className="text-white text-sm sm:text-base mb-8">
          Please try again or contact support if the problem persists.
        </p>

        <div className="space-y-4 space-x-4">
          <Link
            href="/download"
            className="inline-block w-full sm:w-auto px-6 py-3 bg-white text-black font-medium rounded hover:bg-gray-200 transition-all text-center active:scale-[98%]"
          >
            Try Again
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
