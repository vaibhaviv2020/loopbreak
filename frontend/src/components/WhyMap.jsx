export default function WhyMap({ loopDetected, attempts }) {
  const hasAttempts = attempts && attempts.length > 0

  return (
    <section className="panel panel--secondary" aria-labelledby="why-map-heading">
      <div className="panel__header">
        <h2 id="why-map-heading">Why map</h2>
      </div>
      {loopDetected ? (
        <ol className="why-map">
          {hasAttempts ? <li>Repeated attempt</li> : <li>Repeated debugging direction</li>}
          <li>Same debugging direction</li>
          <li>Loop detected</li>
        </ol>
      ) : (
        <p className="empty-state">
          The Why Map will appear when a repeated debugging direction is
          detected.
        </p>
      )}
    </section>
  )
}
