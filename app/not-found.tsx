import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-lg text-[#888] mb-2">Page not found</p>
        <p className="text-sm text-[#555] mb-8">
          The region or page you're looking for doesn't exist. Available regions: US, UK, India, Canada, Australia.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
