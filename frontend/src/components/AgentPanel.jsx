import React from 'react'

export default function AgentPanel({
  agent,
  recalledMemories = [],
  recallLoading,
  recallError,
  onStartAgentB,
  onRecall,
  showManualControls = false,
}) {
  const isAgentB = agent === 'B'
  const memories = recalledMemories || []
  const hasMemories = memories.length > 0
  const isDormant = !hasMemories && !isAgentB

  const primaryMemory = hasMemories ? memories[0] : null

  return (
    <section
      className={`agent-b-workspace ${
        isDormant ? 'agent-b-workspace--dormant' : 'agent-b-workspace--active'
      }`}
      aria-labelledby="agent-b-heading"
    >
      <div className="agent-b-header">
        <div>
          <h2 id="agent-b-heading" className="workspace-pane-title">
            AGENT B
          </h2>
          <p className="workspace-pane-subtitle">
            {hasMemories
              ? 'Active session with persistent memory'
              : isAgentB
              ? 'Fresh session — awaiting recall'
              : 'New debugging session (dormant)'}
          </p>
        </div>
        <span
          className={`badge ${
            hasMemories
              ? 'badge--transfer'
              : isAgentB
              ? 'badge--warn'
              : 'badge--dormant'
          }`}
        >
          {hasMemories ? '● ACTIVE' : isAgentB ? 'ACTIVE' : 'DORMANT'}
        </span>
      </div>

      {showManualControls && (
        <div className="agent-b-actions">
          {!isAgentB ? (
            <button
              type="button"
              className="button button--primary"
              onClick={onStartAgentB}
            >
              Start Agent B Session
            </button>
          ) : (
            <button
              type="button"
              className="button button--transfer"
              onClick={onRecall}
              disabled={recallLoading}
            >
              {recallLoading ? 'Recalling memory...' : 'Recall Memory'}
            </button>
          )}
        </div>
      )}

      {recallError ? (
        <div className="form-error" role="alert">
          {recallError}
        </div>
      ) : null}

      {/* Recalled Memory Display */}
      {hasMemories && primaryMemory ? (
        <div className="recalled-memory-record animate-fade-in">
          <div className="record-badge-strip">
            <span className="record-badge record-badge--transfer">
              MEMORY RECALLED FROM DYNAMODB
            </span>
          </div>

          <div className="memory-fact-grid">
            <div className="memory-fact-item memory-fact-item--deadend">
              <span className="fact-label">SKIPPED DEAD END</span>
              <span className="fact-value font-mono">
                Database hypothesis ruled out
              </span>
            </div>

            <div className="memory-fact-item">
              <span className="fact-label">KNOWN ROOT CAUSE</span>
              <span className="fact-value font-mono">
                {primaryMemory.root_cause ||
                  'Payment latency (~3.8s) exceeds client timeout (2000ms)'}
              </span>
            </div>

            <div className="memory-fact-item memory-fact-item--fix">
              <span className="fact-label">APPLIED FIX</span>
              <span className="fact-value font-mono">
                {primaryMemory.fix ||
                  'Increase payment request timeout from 2s to 5s'}
              </span>
            </div>

            <div className="memory-fact-item">
              <span className="fact-label">VERIFIED RESULT</span>
              <span className="fact-value font-mono text-success">
                {primaryMemory.verification || 'Checkout test passed (Exit 0)'}
              </span>
            </div>
          </div>

          {/* Payoff Section: What Agent B did with this memory */}
          <div className="agent-b-payoff">
            <div className="payoff-title font-mono">AGENT B OUTCOME</div>
            <div className="payoff-item payoff-item--verified">
              <span className="payoff-tag">RESULT</span>
              <span className="payoff-desc font-mono text-success">
                Checkout passes on 1st attempt
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="agent-b-empty">
          <p className="empty-state-title font-mono">
            {isAgentB ? 'Awaiting memory recall...' : 'Session Dormant'}
          </p>
          <p className="empty-state-desc">
            {isAgentB
              ? 'Connecting to DynamoDB /recall endpoint to fetch prior debugging memory...'
              : 'Agent B will start in a clean session and recall Agent A\'s debugging memory.'}
          </p>
        </div>
      )}
    </section>
  )
}
