function attemptStatus(attempt) {
  const result = typeof attempt.result === 'string' ? attempt.result : ''
  const lower = result.toLowerCase()

  if (lower.includes('success') || lower.includes('passed') || lower.includes('verified')) {
    return 'success'
  }

  if (result) {
    return 'failed'
  }

  return 'unknown'
}

export default function AttemptsPanel({ attempts }) {
  const list = attempts || []
  const isEmpty = list.length === 0

  return (
    <section className="journey-step" aria-labelledby="attempts-heading">
      <div className="journey-step__head">
        <h3 id="attempts-heading">Attempts</h3>
        <span className="badge">{list.length} recorded</span>
      </div>
      {isEmpty ? (
        <div className="empty-state">
          <p>No attempts recorded yet.</p>
          <p>Run the first debugging attempt to begin the investigation.</p>
        </div>
      ) : (
        <ol className="attempt-timeline">
          {list.map((attempt, index) => {
            const status = attemptStatus(attempt)

            return (
              <li key={attempt.id || index} className={`attempt-item attempt-item--${status}`}>
                <div className="attempt-item__meta">
                  <span className="attempt-item__number">Attempt {index + 1}</span>
                  <span className={`status-pill status-pill--${status}`}>
                    {status === 'success' ? 'Succeeded' : status === 'failed' ? 'Failed' : 'Recorded'}
                  </span>
                </div>
                {attempt.hypothesis ? (
                  <p className="attempt-item__hypothesis">{attempt.hypothesis}</p>
                ) : null}
                {attempt.hypothesis_category ? (
                  <p className="meta-line">
                    Category <code>{attempt.hypothesis_category}</code>
                  </p>
                ) : null}
                {attempt.result ? (
                  <p className="meta-line">{attempt.result}</p>
                ) : null}
                {attempt.fingerprint ? (
                  <p className="meta-line">
                    Fingerprint <code>{attempt.fingerprint}</code>
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
