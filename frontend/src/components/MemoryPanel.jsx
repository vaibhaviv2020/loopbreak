import React from 'react'

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
  const hasUsableAnalysis = Boolean(analysis && hasValue(analysis.fix))
  const canSave =
    !saved &&
    !loading &&
    Boolean(verification.trim()) &&
    hasUsableAnalysis &&
    hasValue(hypothesisCategory) &&
    hasValue(failedHypotheses) &&
    hasValue(analysis.evidence) &&
    hasValue(analysis.root_cause) &&
    hasValue(analysis.fix)

  if (!analysis && !saved) return null

  return (
    <div className={`case-memory-box ${saved ? 'case-memory-box--saved' : ''}`}>
      <div className="case-memory-header">
        <span className="case-section-title">PERSISTENT MEMORY</span>
        <span className={`badge ${saved ? 'badge--transfer' : 'badge--warn'}`}>
          {saved ? 'SEALED IN DYNAMODB' : 'READY TO PERSIST'}
        </span>
      </div>

      {saved ? (
        <div className="case-memory-saved-note">
          <span className="saved-icon">✓</span>
          <span>Verified debugging memory saved to DynamoDB for Agent B.</span>
        </div>
      ) : (
        <div className="case-memory-form">
          <label className="case-label" htmlFor="verification">
            VERIFICATION EVIDENCE
          </label>
          <input
            id="verification"
            className="case-input"
            value={verification}
            onChange={onVerificationChange}
            placeholder="e.g. Checkout test passed"
            disabled={loading}
          />

          <button
            type="button"
            className="button button--transfer"
            onClick={onSave}
            disabled={!canSave || loading}
          >
            {loading ? 'Saving to DynamoDB...' : 'Seal & Save Memory'}
          </button>
        </div>
      )}

      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}
