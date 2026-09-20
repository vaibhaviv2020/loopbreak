import React from 'react'

function getStatusBadge(attempt) {
  if (attempt.loop_detected) {
    return {
      text: 'REPEATED / LOOP DETECTED',
      className: 'case-badge--loop',
    }
  }

  const result = typeof attempt.result === 'string' ? attempt.result.toLowerCase() : ''
  if (result.includes('success') || result.includes('passed') || result.includes('verified')) {
    return {
      text: 'CONFIRMED / VERIFIED',
      className: 'case-badge--success',
    }
  }

  if (result) {
    return {
      text: 'RULED OUT',
      className: 'case-badge--ruledout',
    }
  }

  return {
    text: 'RECORDED',
    className: 'case-badge--neutral',
  }
}

export default function AttemptsPanel({ attempts }) {
  const list = attempts || []
  const isEmpty = list.length === 0

  return (
    <div className="case-attempts-section">
      <div className="case-section-header">
        <span className="case-section-title">DEBUGGING ATTEMPTS</span>
        <span className="case-count">{list.length} LOGGED</span>
      </div>

      {isEmpty ? (
        <div className="case-empty">
          <p>No attempts recorded in case file.</p>
        </div>
      ) : (
        <ol className="case-attempts-list">
          {list.map((attempt, index) => {
            const badge = getStatusBadge(attempt)
            const idxStr = String(index + 1).padStart(2, '0')

            return (
              <li
                key={attempt.id || index}
                className={`case-attempt-item ${
                  attempt.loop_detected ? 'case-attempt-item--loop' : ''
                }`}
              >
                <div className="case-attempt-top">
                  <span className="case-attempt-idx">{idxStr}</span>
                  <span className={`case-badge ${badge.className}`}>{badge.text}</span>
                </div>

                <div className="case-attempt-body">
                  <div className="case-attempt-hyp">{attempt.hypothesis}</div>

                  <div className="case-attempt-meta">
                    <span className="case-meta-label">CAT:</span>
                    <code className="case-meta-code">{attempt.hypothesis_category}</code>
                    {attempt.fingerprint ? (
                      <>
                        <span className="case-meta-divider">|</span>
                        <span className="case-meta-label">HASH:</span>
                        <code className="case-meta-code">
                          {attempt.fingerprint.slice(0, 8)}…
                        </code>
                      </>
                    ) : null}
                  </div>

                  {attempt.change ? (
                    <div className="case-attempt-change">
                      <span className="case-meta-label">CHANGE:</span> {attempt.change}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
