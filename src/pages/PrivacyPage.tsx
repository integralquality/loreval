import { motion } from 'motion/react';

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Privacy Policy</h1>
        <p className="font-mono text-xs text-zinc-500 mb-10">last updated: March 5, 2026</p>

        <section className="space-y-6 text-zinc-400 text-[15px] leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">What we collect</h2>
            <p>When you create an account, we store:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-zinc-100 font-semibold">Email address</strong> — used to sign in to your account.</li>
              <li><strong className="text-zinc-100 font-semibold">Username</strong> — displayed publicly on levels you publish.</li>
              <li><strong className="text-zinc-100 font-semibold">Levels you create</strong> — the puzzle data (grid layout, DSL code, name) is stored so you can save, edit, and share them.</li>
              <li><strong className="text-zinc-100 font-semibold">Play statistics</strong> — if you play a shared level, we may record whether you completed it and your step count.</li>
              <li><strong className="text-zinc-100 font-semibold">Likes</strong> — which published levels you've liked.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">Why we collect it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To let you save and load your levels across devices.</li>
              <li>To let you share levels with other players via short URLs.</li>
              <li>To show level stats (play count, likes) on the browse page.</li>
              <li>To authenticate you so only you can edit or delete your own levels.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">What we don't do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We don't sell or share your data with third parties.</li>
              <li>We don't use tracking cookies or analytics. The only cookies are for keeping you signed in (strictly necessary).</li>
              <li>We don't send marketing emails.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">Your API key</h2>
            <p>
              If you add your own provider API key, it is stored in your browser's <code className="font-mono text-[13px]">localStorage</code> only. It is sent with your requests to reach the model provider and is never persisted on our servers.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">Where your data is stored</h2>
            <p>
              Your data is stored in <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">Supabase</a>, a hosted database service. Data may be processed in the EU or US depending on the project region.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">Your rights</h2>
            <p>You can at any time:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-zinc-100 font-semibold">Delete your account</strong> — from the Account page. This permanently removes your profile, all your levels, stats, and likes.</li>
              <li><strong className="text-zinc-100 font-semibold">Edit your info</strong> — change your username from the Account page.</li>
              <li><strong className="text-zinc-100 font-semibold">Delete individual levels</strong> — from the My Levels page.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-2">Contact</h2>
            <p>
              If you have questions about your data or want to exercise your rights, reach out at{' '}
              <a href="mailto:privacy@loreval.ai" className="text-orange-400 hover:text-orange-300 underline">privacy@loreval.ai</a>.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
