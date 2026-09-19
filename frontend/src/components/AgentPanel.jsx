function renderMemoryValue(value) {
  if (Array.isArray(value)) {
    return (
      <ul className="stack-list">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === 'string'
              ? item
              : item && typeof item === 'object'
                ? item.hypothesis || item.reason || item.fix || JSON.stringify(item)
                : String(item)}
          </li>
        ))}
      </ul>
    )
  }

  return <p>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
}

const memoryFields = [
  ['Error', 'error'],
  ['Hypothesis category', 'hypothesis_category'],
  ['Failed hypotheses', 'failed_hypotheses'],
  ['Evidence', 'evidence'],
  ['Root cause', 'root_cause'],
  ['Fix', 'fix'],
  ['Verification', 'verification'],
]

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

export default function AgentPanel({
  agent,
  recalledMemories,
  recallLoading,
  recallError,
  onStartAgentB,
  onRecall,
}) {
  const isAgentB = agent === 'B'
  const memories = recalledMemories || []
  const hasMemories = memories.length > 0

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

      <button
        type="button"
        className="button"
        onClick={isAgentB ? onRecall : onStartAgentB}
        disabled={isAgentB && recallLoading}
      >
        {isAgentB && recallLoading
          ? 'Recalling memory...'
          : isAgentB
            ? 'Recall Memory'
            : 'Start Agent B session'}
      </button>
      {recallError ? (
        <p className="form-error" role="alert">
          {recallError}
        </p>
      ) : null}

      <h3 className="field-label">Recalled memory</h3>
      {hasMemories ? (
        memories.map((memory, index) => (
          <div className="agent-b__memory" key={memory.SK || memory.timestamp || index}>
            <p>Previous debugging knowledge</p>
            {memoryFields.map(([label, key]) => {
              const value = memory && typeof memory === 'object' ? memory[key] : null

              return hasValue(value) ? (
                <div key={key}>
                  <h4 className="field-label">{label}</h4>
                  {renderMemoryValue(value)}
                </div>
              ) : null
            })}
          </div>
        ))
      ) : (
        <p className="empty-state">
          {isAgentB
            ? 'No prior debugging memory found.'
            : 'Start a new Agent B session to recall available memory.'}
        </p>
      )}
    </section>
  )
}
