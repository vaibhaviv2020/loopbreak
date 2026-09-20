import React from 'react'

export default function CurrentError({ error }) {
  return (
    <div className="case-error-box" aria-labelledby="error-heading">
      <div className="case-error-header">
        <span className="case-error-tag">OBSERVED ERROR</span>
        <span className="case-error-sub">FAILING INTEGRATION TEST</span>
      </div>
      <div className="case-error-msg" id="error-heading">
        <code>{error || 'Checkout request failed with timeout'}</code>
      </div>
    </div>
  )
}
