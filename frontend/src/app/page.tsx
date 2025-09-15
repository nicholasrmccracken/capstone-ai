// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white px-6">
      {/* Blurb */}
      <h1 className="text-5xl font-bold mb-4 text-blue-400 drop-shadow-md">
        RepoReaper
      </h1>

      {/* Short description */}
      <p className="text-lg text-gray-300 max-w-xl text-center mb-10">
        Analyze GitHub repositories with ease. Upload a repo link, and RepoReaper
        will extract insights, answer your questions, and help you understand the
        project faster.
      </p>

      {/* Button to Chat */}
      <Link
        href="/chat"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-lg font-semibold rounded-lg shadow-md transition-all"
      >
        Get Started
      </Link>
    </main>
  );
}
