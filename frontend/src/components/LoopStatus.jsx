export default function LoopStatus({
  loopDetected,
  analyzeLoading,
  analyzeError,
  onAnalyze,
}) {
  const analyzeDisabled = !loopDetected || analyzeLoading

  return (
    <section
      className={`journey-step${loopDetected ? ' journey-step--loop' : ''}`}
      aria-labelledby="loop-heading"
    >
      <div className="journey-step__head">
        <h3 id="loop-heading">Loop status</h3>
        <span className={loopDetected ? 'badge badge--warn' : 'badge'}>
          {loopDetected ? 'Loop detected' : 'Waiting'}
        </span>
      </div>
      {loopDetected ? (
        <div className="loop-callout" role="status">
          <p className="loop-callout__title">Loop detected</p>
          <p>
            Repeated debugging direction identified. That does not mean the bug
            is solved.
          </p>
        </div>
      ) : (
        <p className="empty-state">Waiting for repeated debugging attempts...</p>
      )}

      <div className="analyze-action">
        <button
          type="button"
          className="button"
          onClick={onAnalyze}
          disabled={analyzeDisabled}
        >
          {analyzeLoading ? 'Analyzing…' : 'Analyze Loop'}
        </button>
        {!loopDetected ? (
          <p className="hint">Available after a loop is detected.</p>
        ) : null}
        {analyzeError ? (
          <p className="form-error" role="alert">
            {analyzeError}
          </p>
        ) : null}
      </div>
    </section>
  )
}
