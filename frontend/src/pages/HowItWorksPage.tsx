/**
 * Explainer page describing the end-to-end product flow.
 */
export function HowItWorksPage(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 animate-fade-in">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-ember">
          Product Guide
        </p>
        <h1 className="mt-2 font-sans text-3xl font-bold text-ink dark:text-white sm:text-4xl">
          How Sentient Roundtable Works
        </h1>
        <p className="mt-3 max-w-3xl font-serif text-base text-slatewarm dark:text-slate-400">
          Start with a question, select your panel, watch real-time multi-agent discussion, then
          review votes and export the final findings as PDF.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
          <h2 className="mb-2 font-sans text-lg font-bold text-ink dark:text-white">1. Setup</h2>
          <p className="font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            Enter a clear burning question, select 2-8 panel models, choose a host, and set the
            number of rounds (1-10). The system runs exactly the rounds you choose.
          </p>
        </article>

        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel delay-75 dark:shadow-panel-dark">
          <h2 className="mb-2 font-sans text-lg font-bold text-ink dark:text-white">2. Access Modes</h2>
          <p className="font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            Use <strong>System (free)</strong> for free models only, or switch to <strong>BYOK</strong>{" "}
            to test paid models using your own OpenRouter key. BYOK keys are session-only and not
            persisted.
          </p>
        </article>

        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel delay-150 dark:shadow-panel-dark">
          <h2 className="mb-2 font-sans text-lg font-bold text-ink dark:text-white">
            3. Live Discussion
          </h2>
          <p className="font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            During each round, models speak sequentially. You see token-level streaming in real
            time, completed turns are locked in the timeline, and host summaries appear between
            rounds.
          </p>
        </article>

        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel delay-225 dark:shadow-panel-dark">
          <h2 className="mb-2 font-sans text-lg font-bold text-ink dark:text-white">
            4. Voting and Synthesis
          </h2>
          <p className="font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            After all rounds complete, each panel model scores peer factual accuracy. The host then
            synthesizes findings into a final report.
          </p>
        </article>

        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel delay-300 md:col-span-2 dark:shadow-panel-dark">
          <h2 className="mb-2 font-sans text-lg font-bold text-ink dark:text-white">5. Export</h2>
          <p className="font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            Once phase is <strong>Complete</strong>, use the session page action to download a PDF
            of the final findings document.
          </p>
        </article>
      </section>

      <section className="mt-6">
        <article className="glass animate-fade-in rounded-2xl p-5 shadow-panel delay-375 dark:shadow-panel-dark">
          <h2 className="mb-3 font-sans text-lg font-bold text-ink dark:text-white">
            How to Get a BYOK Key from OpenRouter
          </h2>
          <div className="space-y-2 font-serif text-sm leading-relaxed text-slatewarm dark:text-slate-400">
            <p>
              1. Create or sign in to your OpenRouter account at{" "}
              <a
                href="https://openrouter.ai/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ember underline decoration-ember/50 underline-offset-2"
              >
                openrouter.ai
              </a>
              .
            </p>
            <p>2. Open the Keys page and generate a new API key.</p>
            <p>3. Copy the key once, then switch Setup to BYOK and paste it into the key field.</p>
            <p>
              4. Start the session. The key is kept only in backend memory for the active session
              and is not written to Redis or files.
            </p>
            <p className="pt-1 text-slatewarm dark:text-slate-400">
              <strong>Note:</strong> To use paid models, your OpenRouter account must have
              sufficient credits in its balance.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
