import { useState } from 'react'

const HYPOTHESIS_CATEGORIES = [
  'database',
  'payment_api',
  'auth',
  'network',
  'cache',
  'configuration',
  'frontend',
]

const emptyForm = {
  hypothesis: '',
  hypothesis_category: '',
  change: '',
  result: '',
  evidence: '',
}

export default function AttemptForm({
  loading,
  error,
  onSubmit,
}) {
  const [fields, setFields] = useState(emptyForm)

  function updateField(name, value) {
    setFields((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const didSucceed = await onSubmit({
      hypothesis: fields.hypothesis.trim(),
      hypothesis_category: fields.hypothesis_category,
      change: fields.change.trim(),
      result: fields.result.trim(),
      evidence: fields.evidence.trim(),
    })

    if (didSucceed) {
      setFields(emptyForm)
    }
  }

  return (
    <form className="attempt-form" onSubmit={handleSubmit}>
      <div className="attempt-form__head">
        <h3>Record attempt</h3>
        {loading ? <span className="badge">Submitting</span> : null}
      </div>
      <p className="hint">
        Session, repository, component, and error come from the current
        debugging context.
      </p>

      <label>
        Hypothesis
        <input
          name="hypothesis"
          value={fields.hypothesis}
          onChange={(event) => updateField('hypothesis', event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <label>
        Hypothesis category
        <select
          name="hypothesis_category"
          value={fields.hypothesis_category}
          onChange={(event) => updateField('hypothesis_category', event.target.value)}
          required
          disabled={loading}
        >
          <option value="">Select a category</option>
          {HYPOTHESIS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label>
        Change
        <input
          name="change"
          value={fields.change}
          onChange={(event) => updateField('change', event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <label>
        Result
        <input
          name="result"
          value={fields.result}
          onChange={(event) => updateField('result', event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <label>
        Evidence
        <input
          name="evidence"
          value={fields.evidence}
          onChange={(event) => updateField('evidence', event.target.value)}
          required
          disabled={loading}
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="button" disabled={loading}>
        {loading ? 'Recording attempt…' : 'Record attempt'}
      </button>
    </form>
  )
}
