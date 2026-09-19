import { useEffect, useRef, useState } from 'react'
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
import {
  ApiError,
  analyzeAttempts,
  createAttempt,
  recallMemory,
  saveMemory,
} from './services/api.js'

export default function App() {
  const [session, setSession] = useState(createInitialSession)
  const agentASession = useRef(null)
  const sessionGeneration = useRef(0)
  const [sseStatus, setSseStatus] = useState('offline')

  function handleAgentEvent(event) {
    const { type, data } = event
    if (!type || !data) return

    switch (type) {
      case 'session_started':
        sessionGeneration.current += 1
        setSession((prev) => ({
          ...createInitialSession(),
          session_id: data.session_id || prev.session_id,
          repo_id: data.repo_id || prev.repo_id,
          component: data.component || prev.component,
          agent: data.agent || 'A',
          attempts: [],
          prior_fingerprints: [],
          analysis: null,
          recalled_memories: [],
          loop_detected: false,
          verification: '',
          memorySaveStatus: 'idle',
          loading: { attempt: false, analyze: false, memory: false, recall: false },
          errors: { attempt: null, analyze: null, memory: null, recall: null },
        }))
        break

      case 'attempt_submitted':
        setSession((prev) => ({
          ...prev,
          attempts: [
            ...prev.attempts,
            {
              hypothesis: data.hypothesis,
              hypothesis_category: data.hypothesis_category,
              change: data.change,
              result: data.result,
              evidence: data.evidence,
            },
          ],
        }))
        break

      case 'attempt_result':
        setSession((prev) => {
          const updatedAttempts = [...prev.attempts]
          if (updatedAttempts.length > 0 && data.fingerprint) {
            const lastIdx = updatedAttempts.length - 1
            updatedAttempts[lastIdx] = {
              ...updatedAttempts[lastIdx],
              fingerprint: data.fingerprint,
              loop_detected: data.loop_detected,
            }
          }
          return {
            ...prev,
            attempts: updatedAttempts,
            prior_fingerprints: Array.isArray(data.updated_fingerprints)
              ? data.updated_fingerprints
              : prev.prior_fingerprints,
            loop_detected:
              typeof data.loop_detected === 'boolean'
                ? data.loop_detected
                : prev.loop_detected,
          }
        })
        break

      case 'loop_detected':
        setSession((prev) => ({
          ...prev,
          loop_detected: true,
        }))
        break

      case 'analysis_started':
        setSession((prev) => ({
          ...prev,
          loading: { ...prev.loading, analyze: true },
          errors: { ...prev.errors, analyze: null },
        }))
        break

      case 'analysis_result':
        setSession((prev) => ({
          ...prev,
          analysis: data.analysis,
          loading: { ...prev.loading, analyze: false },
        }))
        break

      case 'verification':
        setSession((prev) => ({
          ...prev,
          verification: data.result || 'Checkout test passed',
        }))
        break

      case 'memory_saved':
        setSession((prev) => ({
          ...prev,
          memorySaveStatus: 'saved',
        }))
        break

      case 'recall_result':
        setSession((prev) => ({
          ...prev,
          recalled_memories: data.memories || [],
          agent: 'B',
        }))
        break

      default:
        break
    }
  }

  useEffect(() => {
    const sseUrl = import.meta.env.VITE_SSE_URL || 'http://127.0.0.1:8787/events'
    let eventSource = null

    try {
      eventSource = new EventSource(sseUrl)

      eventSource.onopen = () => {
        setSseStatus('connected')
      }

      eventSource.onerror = () => {
        setSseStatus('offline')
      }

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          handleAgentEvent(payload)
        } catch (err) {
          console.warn('[SSE] Error parsing event message:', err)
        }
      }
    } catch (err) {
      console.warn('[SSE] EventSource initialization failed:', err)
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  async function triggerAgent(agentType) {
    const sseTriggerUrl =
      import.meta.env.VITE_SSE_TRIGGER_URL || 'http://127.0.0.1:8787/trigger'
    try {
      await fetch(sseTriggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentType }),
      })
    } catch (err) {
      console.warn('[App] Failed to trigger agent via SSE relay:', err)
    }
  }

  function isCurrentSession(current, requestSessionId, requestGeneration) {
    return (
      current.session_id === requestSessionId &&
      sessionGeneration.current === requestGeneration
    )
  }

  function loadDemoScenario() {
    sessionGeneration.current += 1
    agentASession.current = null
    setSession(createInitialSession())
  }

  function resetDemo() {
    sessionGeneration.current += 1
    agentASession.current = null
    setSession(createInitialSession())
  }

  function startAgentB() {
    sessionGeneration.current += 1
    agentASession.current = session

    setSession((current) => ({
      ...createInitialSession(),
      session_id: 'session-agent-b-001',
      repo_id: current.repo_id,
      component: current.component,
      error: current.error,
      agent: 'B',
    }))
  }

  async function submitAttempt(fields) {
    const requestSessionId = session.session_id
    const requestGeneration = sessionGeneration.current
    const payload = {
      session_id: requestSessionId,
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

    setSession((current) => {
      if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
        return current
      }

      return {
        ...current,
        loading: {
          ...current.loading,
          attempt: true,
        },
        errors: {
          ...current.errors,
          attempt: null,
        },
      }
    })

    try {
      const response = await createAttempt(payload)

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

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
          analysis: null,
          verification: '',
          memorySaveStatus: 'idle',
          loading: {
            ...current.loading,
            attempt: false,
          },
          errors: {
            ...current.errors,
            attempt: null,
            memory: null,
          },
        }
      })

      return true
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to record the debugging attempt.'

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          loading: {
            ...current.loading,
            attempt: false,
          },
          errors: {
            ...current.errors,
            attempt: message,
          },
        }
      })

      return false
    }
  }

  async function analyzeLoop() {
    if (!session.loop_detected || session.loading.analyze) {
      return false
    }

    const requestSessionId = session.session_id
    const requestGeneration = sessionGeneration.current
    const payload = {
      session_id: requestSessionId,
      repo_id: session.repo_id,
      component: session.component,
      error: session.error,
      attempts: session.attempts,
      prior_fingerprints: session.prior_fingerprints,
    }

    setSession((current) => {
      if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
        return current
      }

      return {
        ...current,
        loading: {
          ...current.loading,
          analyze: true,
        },
        errors: {
          ...current.errors,
          analyze: null,
        },
      }
    })

    try {
      const response = await analyzeAttempts(payload)

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          analysis: response,
          loading: {
            ...current.loading,
            analyze: false,
          },
          errors: {
            ...current.errors,
            analyze: null,
          },
        }
      })

      return true
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 501
          ? 'Analysis is currently unavailable.'
          : error instanceof ApiError
            ? error.message
            : 'Unable to analyze the debugging loop.'

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          loading: {
            ...current.loading,
            analyze: false,
          },
          errors: {
            ...current.errors,
            analyze: message,
          },
        }
      })

      return false
    }
  }

  function updateVerification(event) {
    const verification = event.target.value

    setSession((current) => ({
      ...current,
      verification,
      memorySaveStatus:
        current.memorySaveStatus === 'saved' ? 'idle' : current.memorySaveStatus,
      errors: {
        ...current.errors,
        memory: null,
      },
    }))
  }

  async function saveVerifiedMemory() {
    const requestSessionId = session.session_id
    const requestGeneration = sessionGeneration.current
    const analysis = session.analysis
    const verification = session.verification.trim()
    const latestAttempt = session.attempts.at(-1)
    const hypothesisCategory =
      analysis?.hypothesis_category || latestAttempt?.hypothesis_category
    const failedHypotheses =
      analysis?.failed_hypotheses || analysis?.ruled_out

    if (
      !analysis ||
      session.loading.memory ||
      !verification ||
      !hypothesisCategory ||
      !failedHypotheses ||
      !analysis.evidence ||
      !analysis.root_cause ||
      !analysis.fix
    ) {
      return false
    }

    const payload = {
      session_id: requestSessionId,
      repo_id: session.repo_id,
      component: session.component,
      error: session.error,
      hypothesis_category: hypothesisCategory,
      failed_hypotheses: failedHypotheses,
      evidence: analysis.evidence,
      root_cause: analysis.root_cause,
      fix: analysis.fix,
      verification,
    }

    setSession((current) => {
      if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
        return current
      }

      return {
        ...current,
        loading: {
          ...current.loading,
          memory: true,
        },
        memorySaveStatus: 'idle',
        errors: {
          ...current.errors,
          memory: null,
        },
      }
    })

    try {
      await saveMemory(payload)

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          loading: {
            ...current.loading,
            memory: false,
          },
          memorySaveStatus: 'saved',
          errors: {
            ...current.errors,
            memory: null,
          },
        }
      })

      return true
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to save the debugging memory.'

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          loading: {
            ...current.loading,
            memory: false,
          },
          memorySaveStatus: 'idle',
          errors: {
            ...current.errors,
            memory: message,
          },
        }
      })

      return false
    }
  }

  async function recallForAgentB() {
    if (session.agent !== 'B' || session.loading.recall) {
      return false
    }

    const requestSessionId = session.session_id
    const requestGeneration = sessionGeneration.current

    setSession((current) => {
      if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
        return current
      }

      return {
        ...current,
        loading: {
          ...current.loading,
          recall: true,
        },
        errors: {
          ...current.errors,
          recall: null,
        },
      }
    })

    try {
      const response = await recallMemory({
        repo_id: session.repo_id,
        component: session.component,
      })

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          recalled_memories: Array.isArray(response.memories)
            ? response.memories
            : [],
          loading: {
            ...current.loading,
            recall: false,
          },
          errors: {
            ...current.errors,
            recall: null,
          },
        }
      })

      return true
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to recall debugging memory.'

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        return {
          ...current,
          loading: {
            ...current.loading,
            recall: false,
          },
          errors: {
            ...current.errors,
            recall: message,
          },
        }
      })

      return false
    }
  }

  return (
    <div className="app">
      <Header agent={session.agent} />
      <DemoControls
        onLoadDemo={loadDemoScenario}
        onResetDemo={resetDemo}
        onTriggerAgent={triggerAgent}
        sseStatus={sseStatus}
      />
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
        <LoopStatus
          loopDetected={session.loop_detected}
          analyzeLoading={session.loading.analyze}
          analyzeError={session.errors.analyze}
          onAnalyze={analyzeLoop}
        />
        <AnalysisPanel
          analysis={session.analysis}
        />
        <MemoryPanel
          analysis={session.analysis}
          attempts={session.attempts}
          verification={session.verification}
          loading={session.loading.memory}
          error={session.errors.memory}
          memorySaveStatus={session.memorySaveStatus}
          onVerificationChange={updateVerification}
          onSave={saveVerifiedMemory}
        />
      </section>

      <EvidencePanel attempts={session.attempts} analysis={session.analysis} />
      <WhyMap loopDetected={session.loop_detected} attempts={session.attempts} />
      <AgentPanel
        agent={session.agent}
        recalledMemories={session.recalled_memories}
        recallLoading={session.loading.recall}
        recallError={session.errors.recall}
        onStartAgentB={startAgentB}
        onRecall={recallForAgentB}
      />
    </div>
  )
}
