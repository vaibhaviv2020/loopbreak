export default function DemoControls({
  onLoadDemo,
  onResetDemo,
  onTriggerAgent,
  sseStatus = 'offline',
}) {
  return (
    <div className="demo-controls">
      <p className="demo-controls__label">Live lb-agent</p>
      <button
        type="button"
        className="button"
        style={{
          color: 'var(--accent)',
          borderColor: 'var(--accent)',
          fontWeight: 600,
        }}
        onClick={() => onTriggerAgent?.('demo')}
        title="Runs real Agent A (2 attempts -> loop -> Bedrock -> real fix -> real pass) then fresh Agent B (recall -> fix -> real pass)"
      >
        ▶ Run Full 3-Min Demo
      </button>
      <button
        type="button"
        className="button"
        onClick={() => onTriggerAgent?.('A')}
        title="Triggers real Agent A debugging loop and Bedrock resolution"
      >
        Run Agent A
      </button>
      <button
        type="button"
        className="button"
        onClick={() => onTriggerAgent?.('B')}
        title="Triggers fresh Agent B to recall memory and apply fix"
      >
        Run Agent B
      </button>
      <button type="button" className="button" onClick={onLoadDemo}>
        Load Demo Scenario
      </button>
      <button type="button" className="button" onClick={onResetDemo}>
        Reset Console
      </button>

      <span
        style={{
          marginLeft: 'auto',
          fontSize: '0.72rem',
          letterSpacing: '0.05em',
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          color: sseStatus === 'connected' ? 'var(--ok)' : 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor:
              sseStatus === 'connected' ? 'var(--ok)' : 'var(--text-muted)',
          }}
        />
        {sseStatus === 'connected' ? 'SSE Live: 127.0.0.1:8787' : 'SSE Offline'}
      </span>
    </div>
  )
}
