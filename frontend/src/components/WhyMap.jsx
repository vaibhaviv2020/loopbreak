import React from 'react'

export default function WhyMap({
  loopDetected,
  attempts = [],
  analysis = null,
  verification = '',
  memorySaveStatus = 'idle',
  recalledMemories = [],
}) {
  const chain = []

  // 1. Initial hypothesis
  if (attempts.length > 0 && attempts[0].hypothesis) {
    chain.push({
      id: 'initial-hypothesis',
      type: 'hypothesis',
      label: 'Initial hypothesis',
      title: attempts[0].hypothesis,
      detail: `Category: ${attempts[0].hypothesis_category || 'database'}`,
      tag: 'ATTEMPT 01',
      status: 'failed',
    })
  }

  // 2. Database hypothesis repeated / loop detected
  const hasLoop = loopDetected || attempts.some((a) => a.loop_detected)
  if (hasLoop) {
    const loopAttempt =
      attempts.find((a) => a.loop_detected) ||
      (attempts.length > 1 ? attempts[1] : null)
    const category =
      loopAttempt?.hypothesis_category ||
      attempts[0]?.hypothesis_category ||
      'database'
    chain.push({
      id: 'loop-detected',
      type: 'loop',
      label: 'Repeated hypothesis / Loop detected',
      title: loopAttempt?.hypothesis || 'Database connection pool is exhausted',
      detail: `Same ${category} category investigated twice without progress`,
      tag: 'REPEATED ×2',
      status: 'loop',
    })
  }

  // 3. Evidence ruled database out
  if (analysis?.ruled_out && analysis.ruled_out.length > 0) {
    const ruledOutSummary = analysis.ruled_out
      .map((r) => r.hypothesis || r.reason)
      .filter(Boolean)
      .join('; ')
    chain.push({
      id: 'ruled-out',
      type: 'evidence',
      label: 'Evidence ruled hypothesis out',
      title: 'Database connection eliminated as root cause',
      detail: ruledOutSummary || 'Database operations succeeded without error',
      tag: 'NEGATIVE EVIDENCE',
      status: 'ruled-out',
    })
  }

  // 4. Payment latency identified / Root cause
  if (
    analysis?.root_cause ||
    (analysis?.evidence &&
      analysis.evidence.some((e) => e.toLowerCase().includes('payment')))
  ) {
    chain.push({
      id: 'root-cause',
      type: 'root-cause',
      label: 'Payment latency identified',
      title: analysis?.root_cause || 'Payment API response exceeds client timeout',
      detail: 'Gateway responds in ~3.8s, but client timeout is set to 2000ms',
      tag: 'ROOT CAUSE',
      status: 'cause',
    })
  }

  // 5. Timeout fix applied / proposed
  if (
    analysis?.fix ||
    attempts.some((a) => a.hypothesis_category === 'payment_api')
  ) {
    chain.push({
      id: 'fix-applied',
      type: 'fix',
      label: 'Timeout fix applied',
      title: analysis?.fix || 'Increase payment client timeout from 2s to 5s',
      detail: 'Config change in checkoutService: paymentClientTimeoutMs: 5000',
      tag: 'CODE FIX',
      status: 'fix',
    })
  }

  // 6. Verified result
  const hasVerification =
    (typeof verification === 'string' && verification.trim().length > 0) ||
    (analysis?.verification && analysis.verification !== 'Not yet verified') ||
    attempts.some((a) => a.result && a.result.toLowerCase().includes('passed'))

  if (hasVerification) {
    chain.push({
      id: 'verified',
      type: 'verified',
      label: 'Verified result',
      title: 'Checkout test suite passed',
      detail:
        (typeof verification === 'string' && verification.trim()) ||
        analysis?.verification ||
        'Exit code 0 — All integration tests verified',
      tag: 'VERIFIED PASS',
      status: 'success',
    })
  }

  // 7. Memory saved / reusable knowledge (Terminal Node)
  const isSaved = memorySaveStatus === 'saved'
  const hasRecalled = recalledMemories && recalledMemories.length > 0

  if (isSaved || hasRecalled) {
    chain.push({
      id: 'memory-saved',
      type: 'terminal',
      label: hasRecalled ? 'Reusable knowledge recalled' : 'Memory sealed & saved',
      title: 'Persistent Debugging Memory',
      detail: hasRecalled
        ? 'Agent B recalled prior debugging memory from DynamoDB'
        : 'Stored in DynamoDB: demo-checkout#checkoutService',
      tag: 'DYNAMODB MEMORY',
      status: 'transfer',
    })
  }

  return (
    <section className="why-map-workspace" aria-labelledby="why-map-heading">
      <div className="why-map-header">
        <div>
          <h2 id="why-map-heading" className="workspace-pane-title">
            WHY MAP
          </h2>
          <p className="workspace-pane-subtitle">Causal investigation chain</p>
        </div>
        {chain.length > 0 ? (
          <span className="badge badge--ok">{chain.length} stages</span>
        ) : null}
      </div>

      {chain.length === 0 ? (
        <div className="why-map-empty">
          <p className="empty-state-title">No investigation chain yet</p>
          <p className="empty-state-desc">
            Load the demo scenario or record attempts to trace the causal reasoning
            chain.
          </p>
        </div>
      ) : (
        <div className="why-chain-container">
          {chain.map((node, index) => {
            const isLoopNode = node.type === 'loop'
            const isTerminal = node.type === 'terminal'

            return (
              <React.Fragment key={node.id}>
                {/* Loop-back connector SVG between attempt 1 and loop attempt */}
                {isLoopNode ? (
                  <div className="why-loop-indicator" title="Repeated investigation detected">
                    <svg
                      className="why-loop-svg"
                      width="36"
                      height="54"
                      viewBox="0 0 36 54"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M 6 48 C 30 48 30 6 6 6"
                        stroke="var(--loop)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                      <polygon points="6,3 1,8 7,9" fill="var(--loop)" />
                    </svg>
                    <span className="why-loop-label">REPEATED ×2</span>
                  </div>
                ) : null}

                <div
                  className={`why-node why-node--${node.status} ${
                    isTerminal ? 'why-node--terminal' : ''
                  }`}
                >
                  <div className="why-node__header">
                    <span className="why-node__step">STEP 0{index + 1}</span>
                    <span className={`why-node__tag why-node__tag--${node.status}`}>
                      {node.tag}
                    </span>
                  </div>
                  <div className="why-node__title">{node.title}</div>
                  <div className="why-node__detail">{node.detail}</div>
                </div>

                {index < chain.length - 1 && !isLoopNode ? (
                  <div className="why-connector" aria-hidden="true">
                    <span className="why-connector__line" />
                    <span className="why-connector__arrow">↓</span>
                  </div>
                ) : null}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </section>
  )
}
