export default function Header({ agent }) {
  const isActive = agent === 'A' || agent === 'B'

  return (
    <header className="site-header">
      <div className="site-header__identity">
        <h1>LoopBreak</h1>
        <p className="tagline">Debugging memory for AI coding agents</p>
      </div>
      <div
        className="agent-status"
        aria-label={`Agent ${agent}, ${isActive ? 'active' : 'inactive'}`}
      >
        <span className="agent-status__name">Agent {agent}</span>
        <span className="agent-status__live">
          <span className="status-dot" aria-hidden="true" />
          {isActive ? 'Active' : 'Idle'}
        </span>
      </div>
    </header>
  )
}
