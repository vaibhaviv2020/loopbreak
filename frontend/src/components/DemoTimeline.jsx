import React from 'react'

const STAGES = [
  { id: 'failure', number: '01', label: 'FAILURE' },
  { id: 'loop', number: '02', label: 'LOOP' },
  { id: 'evidence', number: '03', label: 'EVIDENCE' },
  { id: 'memory', number: '04', label: 'MEMORY' },
  { id: 'agent-b', number: '05', label: 'AGENT B' },
]

export default function DemoTimeline({ currentStage, onSelectStage }) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage)

  return (
    <nav className="demo-timeline" aria-label="Demo progress timeline">
      <div className="demo-timeline__track">
        {STAGES.map((stage, index) => {
          const isActive = stage.id === currentStage
          const isPassed = currentIndex > index

          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                className={`timeline-step ${isActive ? 'timeline-step--active' : ''} ${
                  isPassed ? 'timeline-step--passed' : ''
                }`}
                onClick={() => onSelectStage?.(stage.id)}
                title={`Stage ${stage.number}: ${stage.label}`}
              >
                <span className="timeline-step__number">
                  {isPassed ? '✓' : stage.number}
                </span>
                <span className="timeline-step__label">{stage.label}</span>
              </button>
              {index < STAGES.length - 1 && (
                <span className="timeline-step__connector" aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </nav>
  )
}

