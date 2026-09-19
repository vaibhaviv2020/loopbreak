function collectObservedEvidence(attempts, analysis) {
  const fromAttempts = (attempts || [])
    .map((attempt) => attempt.evidence)
    .filter((value) => typeof value === 'string' && value.trim())

  const fromAnalysis = analysis && Array.isArray(analysis.evidence)
    ? analysis.evidence.filter((value) => typeof value === 'string' && value.trim())
    : []

  return [...fromAttempts, ...fromAnalysis]
}

function interpretationBlocks(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return []
  }

  const blocks = []

  if (analysis.next_investigation || analysis.nextInvestigation) {
    blocks.push(analysis.next_investigation || analysis.nextInvestigation)
  }

  if (typeof analysis.hypothesis === 'string' && analysis.hypothesis.trim()) {
    blocks.push(analysis.hypothesis)
  }

  return blocks
}

export default function EvidencePanel({ attempts, analysis }) {
  const observed = collectObservedEvidence(attempts, analysis)
  const interpretation = interpretationBlocks(analysis)

  return (
    <section className="panel panel--secondary" aria-labelledby="evidence-heading">
      <div className="panel__header">
        <h2 id="evidence-heading">Evidence / AI reasoning</h2>
      </div>
      <div className="split-fields">
        <div>
          <h3 className="field-label">Observed evidence</h3>
          {observed.length > 0 ? (
            <ul className="stack-list">
              {observed.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              No observed evidence is recorded yet.
            </p>
          )}
        </div>
        <div>
          <h3 className="field-label">AI interpretation</h3>
          {interpretation.length > 0 ? (
            <ul className="stack-list">
              {interpretation.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              AI interpretation will appear after analysis is supplied. It is
              not treated as observed evidence.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
