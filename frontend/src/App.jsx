import { useState } from 'react'
import Header from './components/Header.jsx'
import DemoControls from './components/DemoControls.jsx'
import SessionContext from './components/SessionContext.jsx'
import CurrentError from './components/CurrentError.jsx'
import AttemptsPanel from './components/AttemptsPanel.jsx'
import AttemptForm from './components/AttemptForm.jsx'
import LoopStatus from './components/LoopStatus.jsx'
import AnalysisPanel from './components/AnalysisPanel.jsx'
import EvidencePanel from './components/EvidencePanel.jsx'
import WhyMap from './components/WhyMap.jsx'
import MemoryPanel from './components/MemoryPanel.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import { createInitialSession } from './session.js'
import { ApiError, createAttempt } from './services/api.js'

export default function App() {
  const [session, setSession] = useState(createInitialSession)

  function loadDemoScenario() {
    setSession(createInitialSession())
  }

  function resetDemo() {
    setSession(createInitialSession())
  }

  async function submitAttempt(fields) {
    const payload = {
      session_id: session.session_id,
      repo_id: session.repo_id,
      component: session.component,
      error: session.error,
      hypothesis: fields.hypothesis,
      hypothesis_category: fields.hypothesis_category,
      change: fields.change,
      result: fields.result,
      evidence: fields.evidence,
      prior_fingerprints: session.prior_fingerprints,
    }

    setSession((current) => ({
      ...current,
      loading: {
        ...current.loading,
        attempt: true,
      },
      errors: {
        ...current.errors,
        attempt: null,
      },
    }))

    try {
      const response = await createAttempt(payload)

      setSession((current) => {
        const recordedAttempt = {
          hypothesis: payload.hypothesis,
          hypothesis_category: payload.hypothesis_category,
          change: payload.change,
          result: payload.result,
          evidence: payload.evidence,
          ...(response.fingerprint ? { fingerprint: response.fingerprint } : {}),
          ...(typeof response.loop_detected === 'boolean'
            ? { loop_detected: response.loop_detected }
            : {}),
        }

        return {
          ...current,
          attempts: [...current.attempts, recordedAttempt],
          prior_fingerprints: Array.isArray(response.updated_fingerprints)
            ? response.updated_fingerprints
            : current.prior_fingerprints,
          loop_detected:
            typeof response.loop_detected === 'boolean'
              ? response.loop_detected
              : current.loop_detected,
          loading: {
            ...current.loading,
            attempt: false,
          },
          errors: {
            ...current.errors,
            attempt: null,
          },
        }
      })

      return true
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to record the debugging attempt.'

      setSession((current) => ({
        ...current,
        loading: {
          ...current.loading,
          attempt: false,
        },
        errors: {
          ...current.errors,
          attempt: message,
        },
      }))

      return false
    }
  }

  return (
    <div className="app">
      <Header agent={session.agent} />
      <DemoControls onLoadDemo={loadDemoScenario} onResetDemo={resetDemo} />
      <SessionContext session={session} />
      <CurrentError error={session.error} />

      <section className="journey" aria-labelledby="journey-heading">
        <div className="journey__intro">
          <h2 id="journey-heading">Debugging journey</h2>
          <p className="hint">
            Error → attempts → loop → analysis → fix → memory
          </p>
        </div>
        <AttemptsPanel attempts={session.attempts} />
        <AttemptForm
          loading={session.loading.attempt}
          error={session.errors.attempt}
          onSubmit={submitAttempt}
        />
        <LoopStatus loopDetected={session.loop_detected} />
        <AnalysisPanel
          analysis={session.analysis}
          verification={session.verification}
        />
        <MemoryPanel memorySaveStatus={session.memorySaveStatus} />
      </section>

      <EvidencePanel attempts={session.attempts} analysis={session.analysis} />
      <WhyMap loopDetected={session.loop_detected} attempts={session.attempts} />
      <AgentPanel
        agent={session.agent}
        recalledMemories={session.recalled_memories}
      />
    </div>
  )
}
