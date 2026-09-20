import React from 'react'

export default function SessionContext({ session }) {
  return (
    <div className="case-file-header">
      <div className="case-file-title-row">
        <span className="case-label">CASE FILE</span>
        <span className="case-id"><code>{session.repo_id}#{session.component}</code></span>
        <span className={`case-agent-badge case-agent-badge--${session.agent.toLowerCase()}`}>
          AGENT {session.agent}
        </span>
      </div>

      <div className="case-file-meta-grid">
        <div className="case-meta-cell">
          <span className="case-meta-k">COMPONENT</span>
          <code className="case-meta-v">{session.component}</code>
        </div>
        <div className="case-meta-cell">
          <span className="case-meta-k">REPOSITORY</span>
          <code className="case-meta-v">{session.repo_id}</code>
        </div>
      </div>
    </div>
  )
}
