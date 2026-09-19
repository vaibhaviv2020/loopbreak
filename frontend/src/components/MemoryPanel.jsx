export default function MemoryPanel({ memorySaveStatus }) {
  const saved = memorySaveStatus === 'saved'

  return (
    <section className="journey-step" aria-labelledby="memory-heading">
      <div className="journey-step__head">
        <h3 id="memory-heading">Memory</h3>
        <span className={saved ? 'badge badge--ok' : 'badge'}>
          {saved ? 'Saved' : 'Not saved'}
        </span>
      </div>
      <p className="hint">
        Save verified debugging knowledge. Only verified results should become
        reusable memory.
      </p>
      {saved ? (
        <div className="memory-callout" role="status">
          <p className="memory-callout__title">Memory saved</p>
          <p>This debugging result is available for future agents.</p>
        </div>
      ) : (
        <p className="empty-state">Not saved yet.</p>
      )}
    </section>
  )
}
