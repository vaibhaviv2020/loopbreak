function memoryField(memory, keys) {
  if (!memory || typeof memory !== 'object') {
    return null
  }

  for (const key of keys) {
    const value = memory[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (Array.isArray(value) && value.length > 0) {
      return value
    }
  }

  return null
}

function renderMemoryValue(value) {
  if (Array.isArray(value)) {
    return (
      <ul className="stack-list">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === 'string'
              ? item
              : item.hypothesis || item.reason || item.fix || JSON.stringify(item)}
          </li>
        ))}
      </ul>
    )
  }

  return <p>{value}</p>
}

export default function AgentPanel({ agent, recalledMemories }) {
  const isAgentB = agent === 'B'
  const memories = recalledMemories || []
  const hasMemories = memories.length > 0
  const memory = hasMemories ? memories[0] : null

  const failedDirection = memoryField(memory, [
    'hypothesis_category',
    'failed_hypotheses',
  ])
  const whyFailed = memoryField(memory, ['failed_hypotheses', 'evidence'])
  const rootCause = memoryField(memory, ['root_cause'])
  const previousFix = memoryField(memory, ['fix'])

  return (
    <section className="agent-b" aria-labelledby="agent-b-heading">
      <div className="agent-b__header">
        <div>
          <h2 id="agent-b-heading">Agent B</h2>
          <p className="tagline">New debugging session</p>
        </div>
        <span className="badge">{isAgentB ? 'Active' : 'Waiting'}</span>
      </div>

      <p className="hint">
        Agent A stores verified memory. Agent B starts later and recalls it.
      </p>

      <h3 className="field-label">Recalled memory</h3>
      {hasMemories ? (
        <div className="agent-b__memory">
          <p>Previous debugging knowledge</p>
          <div>
            <h4 className="field-label">Failed direction</h4>
            {failedDirection ? renderMemoryValue(failedDirection) : (
              <p className="empty-state">Not supplied in recalled memory.</p>
            )}
          </div>
          <div>
            <h4 className="field-label">Why it failed</h4>
            {whyFailed ? renderMemoryValue(whyFailed) : (
              <p className="empty-state">Not supplied in recalled memory.</p>
            )}
          </div>
          <div>
            <h4 className="field-label">Root cause</h4>
            {rootCause ? renderMemoryValue(rootCause) : (
              <p className="empty-state">Not supplied in recalled memory.</p>
            )}
          </div>
          <div>
            <h4 className="field-label">Previous fix</h4>
            {previousFix ? renderMemoryValue(previousFix) : (
              <p className="empty-state">Not supplied in recalled memory.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="empty-state">
          No prior debugging memory recalled yet. Start a new Agent B session
          and recall available memory.
        </p>
      )}
    </section>
  )
}
