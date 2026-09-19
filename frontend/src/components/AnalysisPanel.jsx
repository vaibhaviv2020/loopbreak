function presentValue(source, key) {
  if (!source || typeof source !== 'object' || !(key in source)) {
    return null
  }

  const value = source[key]

  return value === null || value === undefined || value === '' ? null : value
}

function renderValue(value) {
  if (Array.isArray(value)) {
    return (
      <ul className="stack-list">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === 'string'
              ? item
              : item && typeof item === 'object'
                ? item.hypothesis || item.reason || JSON.stringify(item)
                : String(item)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <p>
      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
    </p>
  )
}

export default function AnalysisPanel({ analysis }) {
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

  const fields = [
    ['Hypothesis', 'hypothesis'],
    ['Current hypothesis supported', 'current_hypothesis_supported'],
    ['Observed evidence', 'evidence'],
    ['Next investigation', 'next_investigation'],
    ['Ruled out', 'ruled_out'],
    ['Root cause', 'root_cause'],
    ['Fix', 'fix'],
    ['Verification', 'verification'],
  ]
    .map(([label, key]) => ({
      key,
      label,
      value: presentValue(analysis, key),
    }))
    .filter(({ value }) => value !== null)

  const outcomeFields = fields.filter(({ key }) =>
    ['root_cause', 'fix', 'verification'].includes(key),
  )
  const primaryFields = fields.filter(({ key }) =>
    !['root_cause', 'fix', 'verification'].includes(key),
  )

  return (
    <section className="journey-step" aria-labelledby="analysis-heading">
      <div className="journey-step__head">
        <h3 id="analysis-heading">AI analysis</h3>
        <span className="badge">Available</span>
      </div>

      {primaryFields.length > 0 ? (
        <div className="analysis-grid">
          {primaryFields.map(({ key, label, value }) => (
            <div key={key}>
              <h4 className="field-label">{label}</h4>
              {renderValue(value)}
            </div>
          ))}
        </div>
      ) : null}

      {outcomeFields.length > 0 ? (
        <div className="outcome-grid">
          {outcomeFields.map(({ key, label, value }) => (
            <div key={key}>
              <h4 className="field-label">{label}</h4>
              {renderValue(value)}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No analysis fields were supplied.</p>
      )}
    </section>
  )
}
