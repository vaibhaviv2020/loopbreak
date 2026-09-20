import React from 'react'

export default function TransferAnimation({ isTransferring }) {
  if (!isTransferring) return null

  const chips = [
    { id: 'chip-1', text: 'DB hypothesis — ruled out', delay: '0ms' },
    { id: 'chip-2', text: 'Payment latency — root cause', delay: '80ms' },
    { id: 'chip-3', text: 'Timeout fix (5000ms) — verified', delay: '160ms' },
  ]

  return (
    <div className="transfer-animation-track" aria-hidden="true">
      <div className="transfer-animation-label">TRANSFERRING DEBUGGING MEMORY →</div>
      <div className="transfer-chips-container">
        {chips.map((chip) => (
          <div
            key={chip.id}
            className="transfer-chip"
            style={{ animationDelay: chip.delay }}
          >
            <span className="transfer-chip__icon">●</span>
            <span className="transfer-chip__text">{chip.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

