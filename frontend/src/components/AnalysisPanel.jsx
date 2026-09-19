function textValue(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return null
}

function listValue(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value
  }

  return null
}

function firstPresent(source, keys) {
  if (!source || typeof source !== 'object') {
    return null
  }

  for (const key of keys) {
    const value = source[key]
    const asText = textValue(value)
    if (asText) {
      return asText
    }

    const asList = listValue(value)
    if (asList) {
      return asList
    }
  }

  return null
}

function renderValue(value) {
  if (Array.isArray(value)) {
    return (
      <ul className="stack-list">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === 'string'
              ? item
              : item.hypothesis || item.reason || JSON.stringify(item)}
          </li>
        ))}
      </ul>
    )
  }

  return <p>{value}</p>
}

export default function AnalysisPanel({ analysis, verification }) {
  if (!analysis) {
    return (
      <section className="journey-step" aria-labelledby="analysis-heading">
        <div className="journey-step__head">
          <h3 id="analysis-heading">AI analysis</h3>
          <span className="badge">Waiting</span>
        </div>
        <p className="empty-state">
          Analysis will appear after a loop is detected.
        </p>
      </section>
    )
  }

  const hypothesis = firstPresent(analysis, ['hypothesis', 'current_hypothesis'])
  const nextInvestigation = firstPresent(analysis, [
    'next_investigation',
    'nextInvestigation',
  ])
  const rootCause = firstPresent(analysis, ['root_cause', 'rootCause'])
  const fix = firstPresent(analysis, ['fix', 'suggested_fix'])
  const verificationValue =
    textValue(verification) || firstPresent(analysis, ['verification'])
  const ruledOut = firstPresent(analysis, ['ruled_out', 'ruledOut'])
  const analysisEvidence = firstPresent(analysis, ['evidence'])

  const hasOutcome = rootCause || fix || verificationValue

  return (
    <section className="journey-step" aria-labelledby="analysis-heading">
      <div className="journey-step__head">
        <h3 id="analysis-heading">AI analysis</h3>
        <span className="badge">Available</span>
      </div>

      <div className="analysis-grid">
        <div>
          <h4 className="field-label">Hypothesis</h4>
          {hypothesis ? renderValue(hypothesis) : (
            <p className="empty-state">No hypothesis supplied.</p>
          )}
        </div>
        <div>
          <h4 className="field-label">Observed evidence</h4>
          {analysisEvidence ? renderValue(analysisEvidence) : (
            <p className="empty-state">No evidence supplied.</p>
          )}
        </div>
        <div>
          <h4 className="field-label">Next investigation</h4>
          {nextInvestigation ? renderValue(nextInvestigation) : (
            <p className="empty-state">No next investigation supplied.</p>
          )}
        </div>
      </div>
      {ruledOut ? (
        <div>
          <h4 className="field-label">Ruled out</h4>
          {renderValue(ruledOut)}
        </div>
      ) : null}

      {hasOutcome ? (
        <div className="outcome-grid">
          <div>
            <h4 className="field-label">Root cause</h4>
            {rootCause ? renderValue(rootCause) : (
              <p className="empty-state">Not supplied.</p>
            )}
          </div>
          <div>
            <h4 className="field-label">Fix</h4>
            {fix ? renderValue(fix) : (
              <p className="empty-state">Not supplied.</p>
            )}
          </div>
          <div>
            <h4 className="field-label">Verification</h4>
            {verificationValue ? renderValue(verificationValue) : (
              <p className="empty-state">Not verified.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="empty-state">
          Root cause, fix, and verification will appear when they are supplied.
        </p>
      )}
    </section>
  )
}
