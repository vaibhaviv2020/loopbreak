function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

export default function MemoryPanel({
  analysis,
  attempts,
  verification,
  loading,
  error,
  memorySaveStatus,
  onVerificationChange,
  onSave,
}) {
  const saved = memorySaveStatus === 'saved'
  const latestAttempt = attempts?.at(-1)
  const hypothesisCategory =
    analysis?.hypothesis_category || latestAttempt?.hypothesis_category
  const failedHypotheses = analysis?.failed_hypotheses || analysis?.ruled_out
  const canSave =
    !saved &&
    !loading &&
    Boolean(verification.trim()) &&
    analysis &&
    hasValue(hypothesisCategory) &&
    hasValue(failedHypotheses) &&
    hasValue(analysis.evidence) &&
    hasValue(analysis.root_cause) &&
    hasValue(analysis.fix)

  return (
    <section className="journey-step" aria-labelledby="memory-heading">
      <div className="journey-step__head">
        <h3 id="memory-heading">Memory</h3>
        <span className={saved ? 'badge badge--ok' : 'badge'}>
          {saved ? 'Saved' : 'Not saved'}
        </span>
      </div>
      <p className="hint">
        Save verified debugging knowledge. Only verified results should become
        reusable memory.
      </p>
      <label className="field-label" htmlFor="verification">
        Verification
      </label>
      <textarea
        id="verification"
        value={verification}
        onChange={onVerificationChange}
        placeholder="Describe how the fix was verified."
        disabled={saved || loading}
        rows="3"
      />
      {saved ? (
        <div className="memory-callout" role="status">
          <p className="memory-callout__title">Memory saved</p>
          <p>This debugging result is available for future agents.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="button"
            onClick={onSave}
            disabled={!canSave}
          >
            {loading ? 'Saving memory...' : 'Save Memory'}
          </button>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {!canSave && !error ? (
            <p className="empty-state">
              Verification required before memory can be saved.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
