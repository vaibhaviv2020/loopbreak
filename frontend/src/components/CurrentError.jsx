export default function CurrentError({ error }) {
  return (
    <section className="error-banner" aria-labelledby="error-heading">
      <div className="error-banner__heading">
        <span className="error-icon" aria-hidden="true">
          !
        </span>
        <h2 id="error-heading">Current error</h2>
      </div>
      <p className="error-message">{error}</p>
      <p className="hint">Observed failure. Not an AI interpretation.</p>
    </section>
  )
}
