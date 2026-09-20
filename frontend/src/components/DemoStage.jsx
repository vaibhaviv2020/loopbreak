import React from 'react'

export default function DemoStage({
  currentStage,
  session,
  isTransferring,
  onRunDemo,
  isRunningDemo,
  demoError,
}) {
  const attempts = session?.attempts || []
  const analysis = session?.analysis
  const recalledMemories = session?.recalled_memories || []
  const hasLoop = session?.loop_detected || attempts.some((a) => a.loop_detected)
  const isMemorySaved = session?.memorySaveStatus === 'saved'

  // Extract deduplicated observed evidence
  const observedEvidence = React.useMemo(() => {
    const list = []
    if (analysis && Array.isArray(analysis.evidence)) {
      list.push(...analysis.evidence)
    }
    for (const a of attempts) {
      if (typeof a.evidence === 'string' && a.evidence.trim()) {
        list.push(a.evidence)
      }
    }
    // Clean up long combined strings into crisp bullets
    const cleanItems = []
    for (const item of list) {
      if (item.includes(';')) {
        const parts = item.split(';').map((p) => p.trim()).filter(Boolean)
        cleanItems.push(...parts)
      } else {
        cleanItems.push(item)
      }
    }
    // Filter and deduplicate
    const unique = Array.from(new Set(cleanItems)).filter(
      (item) =>
        !item.toLowerCase().includes('exit code') &&
        !item.toLowerCase().includes('not yet') &&
        item.length < 120
    )
    if (unique.length === 0) {
      return [
        'Database query completes successfully',
        'Payment API responds after approximately 3.8 seconds',
        'Client timeout is 2 seconds',
      ]
    }
    return unique.slice(0, 3)
  }, [analysis, attempts])

  return (
    <section className="demo-stage-container" aria-label="Demo Theater Stage">
      {/* Progressive Causal Chain Strip */}
      <div className="causal-strip" aria-label="Causal reasoning progression">
        <span className={`causal-node ${currentStage ? 'causal-node--active' : ''}`}>
          01 ERROR
        </span>
        <span className="causal-arrow">→</span>
        <span
          className={`causal-node ${
            ['loop', 'evidence', 'memory', 'agent-b'].includes(currentStage)
              ? 'causal-node--active'
              : ''
          }`}
        >
          02 LOOP
        </span>
        <span className="causal-arrow">→</span>
        <span
          className={`causal-node ${
            ['evidence', 'memory', 'agent-b'].includes(currentStage)
              ? 'causal-node--active'
              : ''
          }`}
        >
          03 EVIDENCE
        </span>
        <span className="causal-arrow">→</span>
        <span
          className={`causal-node ${
            ['memory', 'agent-b'].includes(currentStage) ? 'causal-node--active' : ''
          }`}
        >
          04 MEMORY
        </span>
        <span className="causal-arrow">→</span>
        <span
          className={`causal-node ${
            currentStage === 'agent-b' ? 'causal-node--active' : ''
          }`}
        >
          05 RECALL
        </span>
      </div>

      {demoError && (
        <div className="demo-stage__error" role="alert">
          <span className="demo-error__icon">⚠</span>
          <span className="demo-error__msg">{demoError}</span>
        </div>
      )}

      {/* SCENE 1: FAILURE */}
      {currentStage === 'failure' && (
        <div className="scene scene--failure animate-fade-in">
          <div className="scene-header">
            <span className="scene-tag">SCENE 01</span>
            <h2 className="scene-title">AGENT A / INCIDENT</h2>
            <p className="scene-subtitle">
              Agent A encounters an unhandled integration test failure.
            </p>
          </div>

          <div className="scene-card scene-card--incident">
            <div className="card-row">
              <span className="card-label">TARGET REPOSITORY</span>
              <span className="card-value font-mono">demo-checkout</span>
            </div>
            <div className="card-row">
              <span className="card-label">COMPONENT</span>
              <span className="card-value font-mono">checkoutService.js</span>
            </div>
            <div className="card-row card-row--error">
              <span className="card-label">OBSERVED ERROR</span>
              <span className="card-value card-value--error font-mono">
                Checkout request failed with timeout
              </span>
            </div>
            <div className="card-row card-row--code">
              <span className="card-label">FAILING TEST OUTPUT</span>
              <pre className="card-terminal font-mono">
{`$ node test/checkout.test.js
Running Checkout Test Suite...
Error: Payment API response exceeded client timeout of 2000ms (latency ~3800ms)
Exit code 1 — Integration test failed`}
              </pre>
            </div>
          </div>

          <div className="scene-footer">
            <span className="scene-pulse" />
            <span className="scene-footer__text">
              Agent A begins autonomous investigation...
            </span>
          </div>
        </div>
      )}

      {/* SCENE 2: LOOP DETECTED */}
      {currentStage === 'loop' && (
        <div className="scene scene--loop animate-fade-in">
          <div className="scene-header">
            <span className="scene-tag scene-tag--loop">SCENE 02</span>
            <h2 className="scene-title">DEBUGGING LOOP DETECTED</h2>
            <p className="scene-subtitle">
              LoopBreak detected repeated investigation in the same category without progress.
            </p>
          </div>

          <div className="loop-banner">
            <div className="loop-banner__badge">REPEATED ×2</div>
            <div className="loop-banner__text">
              <strong>Category: database</strong>
              <span>Same debugging category investigated again without progress.</span>
            </div>
          </div>

          <div className="scene-attempts-list">
            <div className="scene-attempt-row">
              <div className="attempt-row__badge">ATTEMPT 01</div>
              <div className="attempt-row__content">
                <div className="attempt-row__title font-mono">
                  The database connection is timing out
                </div>
                <div className="attempt-row__change font-mono">
                  change: databaseTimeoutMs: 2000 → 5000
                </div>
              </div>
              <span className="attempt-status attempt-status--failed">
                RULED OUT
              </span>
            </div>

            <div className="scene-attempt-row scene-attempt-row--repeated">
              <div className="attempt-row__badge attempt-row__badge--repeated">
                ATTEMPT 02
              </div>
              <div className="attempt-row__content">
                <div className="attempt-row__title font-mono">
                  The database connection pool is exhausted
                </div>
                <div className="attempt-row__change font-mono">
                  change: databasePoolSize: 10 → 50
                </div>
              </div>
              <span className="attempt-status attempt-status--loop">
                REPEATED
              </span>
            </div>
          </div>

          <div className="scene-fingerprint font-mono">
            <span>FINGERPRINT:</span>
            <code>{session.prior_fingerprints?.[0] || '200dc858e890c312cf9e03e9853daf125dafac587a88f7ec2f00931d1f4a89f2'}</code>
            <span className="fingerprint-status">MATCH CONFIRMED</span>
          </div>
        </div>
      )}

      {/* SCENE 3: EVIDENCE / ANALYSIS */}
      {currentStage === 'evidence' && (
        <div className="scene scene--evidence animate-fade-in">
          <div className="scene-header">
            <div className="scene-header__top">
              <span className="scene-tag scene-tag--evidence">SCENE 03</span>
              <span className="scene-adapter-badge">
                AI ANALYSIS (DETERMINISTIC DEMO MODE)
              </span>
            </div>
            <h2 className="scene-title">EVIDENCE BREAKS THE LOOP</h2>
            <p className="scene-subtitle">
              Negative telemetry rules out the database and isolates the true root cause.
            </p>
          </div>

          <div className="evidence-grid">
            <div className="evidence-col evidence-col--observed">
              <div className="col-header">
                <span className="col-tag">OBSERVED EVIDENCE</span>
                <span className="col-hint">Telemetry recorded during execution</span>
              </div>
              <ul className="evidence-checklist">
                {observedEvidence.map((item, idx) => (
                  <li key={idx} className="evidence-item">
                    <span className="evidence-check">✓</span>
                    <span className="evidence-text font-mono">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="evidence-col evidence-col--reasoning">
              <div className="col-header">
                <span className="col-tag">AI INTERPRETATION</span>
                <span className="col-hint">Causal deduction from evidence</span>
              </div>

              <div className="reasoning-block reasoning-block--cause">
                <span className="reasoning-label">ROOT CAUSE</span>
                <p className="reasoning-val font-mono">
                  {analysis?.root_cause ||
                    'Payment API latency of approximately 3.8 seconds exceeds the checkout client timeout of 2 seconds.'}
                </p>
              </div>

              <div className="reasoning-block reasoning-block--fix">
                <span className="reasoning-label">VERIFIED FIX</span>
                <p className="reasoning-val font-mono">
                  {analysis?.fix ||
                    'Increase the checkout client timeout from 2 seconds to 5 seconds.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCENE 4: MEMORY SAVED */}
      {currentStage === 'memory' && (
        <div className="scene scene--memory animate-fade-in">
          <div className="scene-header">
            <span className="scene-tag scene-tag--memory">SCENE 04</span>
            <h2 className="scene-title">DEBUGGING KNOWLEDGE PERSISTED</h2>
            <p className="scene-subtitle">
              Verified decision and negative hypotheses sealed and saved to DynamoDB.
            </p>
          </div>

          <div className="memory-card">
            <div className="memory-card__header">
              <div className="memory-card__meta">
                <span className="badge badge--dynamo">DYNAMODB</span>
                <span className="font-mono memory-table">LoopBreakMemory</span>
              </div>
              <div className="memory-card__status">
                <span className="infra-dot" /> MEMORY SAVED
              </div>
            </div>

            <div className="memory-card__body">
              <div className="memory-row">
                <span className="memory-label">BUG</span>
                <span className="memory-val font-mono">
                  Checkout request failed with timeout
                </span>
              </div>
              <div className="memory-row">
                <span className="memory-label">FAILED HYPOTHESES</span>
                <span className="memory-val font-mono text-muted">
                  Database timeout / Database connection pool (RULED OUT)
                </span>
              </div>
              <div className="memory-row">
                <span className="memory-label">ROOT CAUSE</span>
                <span className="memory-val font-mono">
                  Payment API latency (~3.8s) exceeds client timeout (2s)
                </span>
              </div>
              <div className="memory-row">
                <span className="memory-label">VERIFIED FIX</span>
                <span className="memory-val font-mono text-success">
                  Increase client timeout 2s → 5s (paymentClientTimeoutMs: 5000)
                </span>
              </div>
              <div className="memory-row">
                <span className="memory-label">VERIFICATION</span>
                <span className="memory-val font-mono text-success">
                  ✓ Checkout integration test passed (Exit code 0)
                </span>
              </div>
            </div>
          </div>

          <div className="scene-footer">
            <span className="scene-footer__text font-mono">
              Saved key: demo-checkout#checkoutService · Ready for recall by new agents
            </span>
          </div>
        </div>
      )}

      {/* SCENE 5: AGENT B RECALL */}
      {currentStage === 'agent-b' && (
        <div className="scene scene--agentb animate-fade-in">
          <div className="scene-header">
            <span className="scene-tag scene-tag--agentb">SCENE 05 — HERO MOMENT</span>
            <h2 className="scene-title">AGENT B / FRESH SESSION</h2>
            <p className="scene-subtitle">
              Fresh agent session recalls prior debugging memory and bypasses known dead ends.
            </p>
          </div>

          <div className="agentb-showcase">
            <div className="agentb-card agentb-card--recall">
              <div className="agentb-card__head">
                <span className="card-badge">RECALLED FROM LOOPBREAK</span>
                <span className="font-mono card-sub">GET /recall → 200 OK</span>
              </div>
              <ul className="recalled-facts">
                <li className="fact-item">
                  <span className="fact-icon text-loop">✕</span>
                  <span className="fact-text font-mono">
                    <strong>Database hypotheses:</strong> Already ruled out (skipped 2 attempts)
                  </span>
                </li>
                <li className="fact-item">
                  <span className="fact-icon text-success">✓</span>
                  <span className="fact-text font-mono">
                    <strong>Root cause identified:</strong> Payment API exceeds client timeout
                  </span>
                </li>
                <li className="fact-item">
                  <span className="fact-icon text-success">✓</span>
                  <span className="fact-text font-mono">
                    <strong>Verified fix available:</strong> Client timeout 2s → 5s
                  </span>
                </li>
              </ul>
            </div>

            <div className="agentb-flow">
              <div className="flow-step">
                <span className="flow-step__tag">STEP 1</span>
                <span className="flow-step__title">SKIPPED DEAD END</span>
                <span className="flow-step__sub font-mono">0 wasted attempts</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <span className="flow-step__tag">STEP 2</span>
                <span className="flow-step__title">APPLIED VERIFIED FIX</span>
                <span className="flow-step__sub font-mono">paymentClientTimeoutMs: 5000</span>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step flow-step--success">
                <span className="flow-step__tag flow-step__tag--pass">OUTCOME</span>
                <span className="flow-step__title text-success">
                  ✓ CHECKOUT TEST PASSED
                </span>
                <span className="flow-step__sub font-mono">Exit code 0</span>
              </div>
            </div>
          </div>

          <div className="hero-payoff-banner">
            <div className="hero-payoff-text">
              <strong>LoopBreak debugging memory transferred between sessions.</strong>
              <span>Agent A spent cycles diagnosing the bug. Agent B resolved it immediately.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

