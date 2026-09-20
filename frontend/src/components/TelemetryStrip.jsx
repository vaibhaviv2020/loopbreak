import React from 'react'

export default function TelemetryStrip({ session, sseStatus }) {
  return (
    <footer className="telemetry-strip" aria-label="Runtime telemetry">
      <div className="telemetry-strip__item">
        <span className="telemetry-label">LAMBDA:</span>
        <span className="telemetry-val">LoopBreakBackend (eu-north-1)</span>
      </div>
      <div className="telemetry-strip__divider">|</div>
      <div className="telemetry-strip__item">
        <span className="telemetry-label">DYNAMODB:</span>
        <span className="telemetry-val">LoopBreakMemory</span>
      </div>
      <div className="telemetry-strip__divider">|</div>
      <div className="telemetry-strip__item">
        <span className="telemetry-label">SSE RELAY:</span>
        <span
          className={`telemetry-val ${
            sseStatus === 'connected' ? 'telemetry-val--ok' : 'telemetry-val--warn'
          }`}
        >
          :8787 ({sseStatus})
        </span>
      </div>
      <div className="telemetry-strip__divider">|</div>
      <div className="telemetry-strip__item telemetry-strip__item--right">
        <span className="telemetry-label">SESSION:</span>
        <code className="telemetry-val">{session?.session_id || 'idle'}</code>
      </div>
    </footer>
  )
}

