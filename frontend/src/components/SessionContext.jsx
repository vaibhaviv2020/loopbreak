export default function SessionContext({ session }) {
  return (
    <section className="context-bar" aria-labelledby="session-heading">
      <h2 id="session-heading" className="visually-hidden">
        Session context
      </h2>
      <dl className="context-bar__list">
        <div>
          <dt>Session</dt>
          <dd>
            <code>{session.session_id}</code>
          </dd>
        </div>
        <div>
          <dt>Repository</dt>
          <dd>
            <code>{session.repo_id}</code>
          </dd>
        </div>
        <div>
          <dt>Component</dt>
          <dd>
            <code>{session.component}</code>
          </dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd>Agent {session.agent}</dd>
        </div>
      </dl>
    </section>
  )
}
