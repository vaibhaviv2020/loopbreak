export default function DemoControls({ onLoadDemo, onResetDemo }) {
  return (
    <div className="demo-controls">
      <p className="demo-controls__label">Local demo</p>
      <button type="button" className="button" onClick={onLoadDemo}>
        Load Demo Scenario
      </button>
      <button type="button" className="button" onClick={onResetDemo}>
        Reset Demo
      </button>
      <p className="hint">
        Resets this browser session only. Does not delete DynamoDB memory.
      </p>
    </div>
  )
}
