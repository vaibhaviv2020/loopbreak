import React from 'react'

export default function LoopStatus({
  loopDetected,
  analyzeLoading,
  analyzeError,
  onAnalyze,
}) {
  const analyzeDisabled = !loopDetected || analyzeLoading

  return (
    <div
      className={`case-loop-box ${
        loopDetected ? 'case-loop-box--detected' : 'case-loop-box--idle'
      }`}
    >
      <div className="case-loop-top">
        <div className="case-loop-indicator">
          <span
            className={`status-dot ${
              loopDetected ? 'status-dot--loop' : 'status-dot--idle'
            }`}
          />
          <span className="case-loop-title">
            {loopDetected ? 'LOOP DETECTED' : 'LOOP DETECTION: MONITORING'}
          </span>
        </div>
        <span
          className={`badge ${
            loopDetected ? 'badge--loop' : 'badge--idle'
          }`}
        >
          {loopDetected ? 'REPEATED ×2' : 'NORMAL'}
        </span>
      </div>

      {loopDetected ? (
        <p className="case-loop-desc">
          Repeated database hypothesis recorded. Intervention required to break
          the dead-end loop.
        </p>
      ) : null}

      <div className="case-loop-action">
        <button
          type="button"
          className={`button ${
            loopDetected ? 'button--analyze' : 'button--disabled'
          }`}
          onClick={onAnalyze}
          disabled={analyzeDisabled}
        >
          {analyzeLoading ? 'Analyzing via Bedrock...' : '⚡ Analyze Loop'}
        </button>
        {analyzeError ? (
          <div className="form-error" role="alert">
            {analyzeError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
