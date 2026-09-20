import React from 'react'

export default function Header({
  agent,
  onLoadDemo,
  onResetDemo,
  onRunDemo,
  isRunningDemo,
  demoCompleted,
  sseStatus,
}) {
  return (
    <header className="site-header">
      <div className="site-header__left">
        <div className="brand-group">
          <span className="brand-name">LOOPBREAK</span>
          <span className="brand-divider">/</span>
          <span className="brand-tagline">
            Persistent debugging memory for coding agents
          </span>
        </div>
      </div>

      <div className="site-header__center">
        <div className="infra-pills">
          <span className="infra-pill infra-pill--live">
            <span className="infra-dot" /> LIVE
          </span>
          <span className="infra-pill">Lambda</span>
          <span className="infra-pill">DynamoDB</span>
          <span
            className={`infra-pill ${
              sseStatus === 'connected' ? 'infra-pill--sse-ok' : 'infra-pill--sse-off'
            }`}
          >
            SSE {sseStatus === 'connected' ? ':8787' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="site-header__right">
        <button
          type="button"
          data-testid="run-demo-btn"
          className={`hdr-btn hdr-btn--demo ${
            isRunningDemo ? 'hdr-btn--running' : ''
          }`}
          onClick={() => {
            console.log('[Header] Run Demo button clicked!')
            onRunDemo?.()
          }}
          disabled={isRunningDemo}
          title={
            isRunningDemo
              ? 'Demo in progress...'
              : demoCompleted
              ? 'Re-run full automated demo sequence'
              : 'Runs automated 15–20s demo sequence'
          }
        >
          {isRunningDemo
            ? '● Running Demo...'
            : demoCompleted
            ? '▶ Run Demo Again'
            : '▶ Run Demo'}
        </button>

        <button
          type="button"
          className="hdr-btn"
          onClick={onLoadDemo}
          disabled={isRunningDemo}
          title="Prepare scenario and display Scene 1"
        >
          Load Demo
        </button>

        <button
          type="button"
          className="hdr-btn hdr-btn--reset"
          onClick={onResetDemo}
          title="Clean reset session"
        >
          Reset
        </button>
      </div>
    </header>
  )
}
