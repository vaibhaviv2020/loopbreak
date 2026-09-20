import { useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import DemoTimeline from './components/DemoTimeline.jsx'
import DemoStage from './components/DemoStage.jsx'
import SessionContext from './components/SessionContext.jsx'
import CurrentError from './components/CurrentError.jsx'
import AttemptsPanel from './components/AttemptsPanel.jsx'
import AttemptForm from './components/AttemptForm.jsx'
import LoopStatus from './components/LoopStatus.jsx'
import MemoryPanel from './components/MemoryPanel.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import TransferAnimation from './components/TransferAnimation.jsx'
import TelemetryStrip from './components/TelemetryStrip.jsx'
import { createInitialSession, createDemoScenarioSession } from './session.js'
import {
  ApiError,
  analyzeAttempts,
  createAttempt,
  recallMemory,
  saveMemory,
} from './services/api.js'

export default function App() {
  const [session, setSession] = useState(createInitialSession)
  const [currentStage, setCurrentStage] = useState('failure')
  const [isRunningDemo, setIsRunningDemo] = useState(false)
  const [demoCompleted, setDemoCompleted] = useState(false)
  const [demoError, setDemoError] = useState(null)
  const [sseStatus, setSseStatus] = useState('offline')
  const [isTransferring, setIsTransferring] = useState(false)

  const sessionGeneration = useRef(0)
  const demoAbortRef = useRef(false)
  const activeTimeouts = useRef([])

  function safeTimeout(fn, ms) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        if (!demoAbortRef.current) {
          fn()
        }
        resolve()
      }, ms)
      activeTimeouts.current.push({ id, resolve })
    })
  }

  function clearAllTimeouts() {
    activeTimeouts.current.forEach((item) => {
      if (item && item.id) {
        clearTimeout(item.id)
        if (typeof item.resolve === 'function') {
          item.resolve()
        }
      } else if (item) {
        clearTimeout(item)
      }
    })
    activeTimeouts.current = []
  }

  // Handle SSE events from lb-agent if running
  function handleAgentEvent(event) {
    const { type, data } = event
    if (!type || !data) return

    switch (type) {
      case 'session_started':
        sessionGeneration.current += 1
        if (data.agent === 'B') {
          setCurrentStage('agent-b')
          setSession((prev) => ({
            ...prev,
            agent: 'B',
            session_id: data.session_id || `session-agent-b-${Date.now()}`,
          }))
        } else {
          setCurrentStage('failure')
          setSession((prev) => ({
            ...createInitialSession(),
            session_id: data.session_id || prev.session_id,
            repo_id: data.repo_id || prev.repo_id,
            component: data.component || prev.component,
            agent: 'A',
          }))
        }
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
        setCurrentStage('loop')
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
        setCurrentStage('evidence')
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
        setCurrentStage('memory')
        setSession((prev) => ({
          ...prev,
          memorySaveStatus: 'saved',
        }))
        break

      case 'recall_result':
        setCurrentStage('agent-b')
        setIsTransferring(true)
        setTimeout(() => setIsTransferring(false), 900)
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
      clearAllTimeouts()
    }
  }, [])

  useEffect(() => {
    window.runLoopBreakDemo = runAutomatedDemo
    window.loadLoopBreakDemo = loadDemoScenario
    window.resetLoopBreakDemo = resetDemo
  })

  function isCurrentSession(current, requestSessionId, requestGeneration) {
    return (
      current.session_id === requestSessionId &&
      sessionGeneration.current === requestGeneration
    )
  }

  function loadDemoScenario() {
    demoAbortRef.current = true
    clearAllTimeouts()
    setIsRunningDemo(false)
    setDemoCompleted(false)
    setDemoError(null)
    setCurrentStage('failure')
    sessionGeneration.current += 1
    setSession(createDemoScenarioSession())
  }

  function resetDemo() {
    demoAbortRef.current = true
    clearAllTimeouts()
    setIsRunningDemo(false)
    setDemoCompleted(false)
    setDemoError(null)
    setIsTransferring(false)
    setCurrentStage('failure')
    sessionGeneration.current += 1
    setSession(createInitialSession())
  }

  // AUTOMATED 1-CLICK DEMO ORCHESTRATION
  async function runAutomatedDemo() {
    console.log('[App] runAutomatedDemo triggered, isRunningDemo:', isRunningDemo)
    if (isRunningDemo) return

    demoAbortRef.current = false
    clearAllTimeouts()
    setIsRunningDemo(true)
    setDemoCompleted(false)
    setDemoError(null)

    sessionGeneration.current += 1
    const requestGen = sessionGeneration.current
    const sessionId = `session-agent-a-${Date.now()}`

    // 1. SCENE 1: FAILURE (0–2s)
    console.log('[App] Starting Scene 1: FAILURE')
    setCurrentStage('failure')
    setSession({
      ...createInitialSession(),
      session_id: sessionId,
      repo_id: 'demo-checkout',
      component: 'checkoutService',
      error: 'Checkout request failed with timeout',
      agent: 'A',
    })

    await safeTimeout(() => {}, 2000)
    if (demoAbortRef.current) {
      console.log('[App] Demo aborted after Scene 1')
      return
    }

    // 2. SCENE 2: LOOP (2–6s)
    try {
      console.log('[App] Starting Scene 2: Submitting Attempt 1')
      // Attempt 1: Database timeout
      const att1Payload = {
        session_id: sessionId,
        repo_id: 'demo-checkout',
        component: 'checkoutService',
        error: 'Checkout request failed with timeout',
        hypothesis: 'The database connection is timing out',
        hypothesis_category: 'database',
        change: 'Replaced "databaseTimeoutMs: 2000" with "databaseTimeoutMs: 5000" in src/checkoutService.js',
        result: 'Failed with exit code 1',
        evidence: 'Database query completes successfully; Payment API responds after approximately 3.8 seconds. Client timeout is 2 seconds',
        prior_fingerprints: [],
      }

      const res1 = await createAttempt(att1Payload)
      if (demoAbortRef.current) return

      const recordedAtt1 = {
        ...att1Payload,
        fingerprint: res1.fingerprint,
        loop_detected: false,
      }

      setSession((prev) => ({
        ...prev,
        attempts: [recordedAtt1],
        prior_fingerprints: res1.updated_fingerprints || [],
      }))

      await safeTimeout(() => {}, 1200)
      if (demoAbortRef.current) return

      // Attempt 2: Database pool size (Triggers Loop Detection)
      const att2Payload = {
        session_id: sessionId,
        repo_id: 'demo-checkout',
        component: 'checkoutService',
        error: 'Checkout request failed with timeout',
        hypothesis: 'The database connection pool is exhausted',
        hypothesis_category: 'database',
        change: 'Replaced "databasePoolSize: 10" with "databasePoolSize: 50" in src/checkoutService.js',
        result: 'Failed with exit code 1',
        evidence: 'Database query completes successfully; Payment API responds after approximately 3.8 seconds. Client timeout is 2 seconds',
        prior_fingerprints: res1.updated_fingerprints || [],
      }

      const res2 = await createAttempt(att2Payload)
      if (demoAbortRef.current) return

      const recordedAtt2 = {
        ...att2Payload,
        fingerprint: res2.fingerprint,
        loop_detected: true,
      }

      setSession((prev) => ({
        ...prev,
        attempts: [recordedAtt1, recordedAtt2],
        prior_fingerprints: res2.updated_fingerprints || [],
        loop_detected: true,
      }))
      setCurrentStage('loop')

      await safeTimeout(() => {}, 3000)
      if (demoAbortRef.current) return

      // 3. SCENE 3: EVIDENCE / ANALYSIS (6–11s)
      const analyzePayload = {
        session_id: sessionId,
        repo_id: 'demo-checkout',
        component: 'checkoutService',
        error: 'Checkout request failed with timeout',
        attempts: [recordedAtt1, recordedAtt2],
        prior_fingerprints: res2.updated_fingerprints || [],
      }

      const rawAnalysisRes = await analyzeAttempts(analyzePayload)
      if (demoAbortRef.current) return

      // Unpack analysis correctly to fix "No analysis fields were supplied" bug
      const analysisData = rawAnalysisRes.analysis || rawAnalysisRes

      setSession((prev) => ({
        ...prev,
        analysis: analysisData,
      }))
      setCurrentStage('evidence')

      await safeTimeout(() => {}, 4000)
      if (demoAbortRef.current) return

      // 4. SCENE 4: MEMORY SAVED (11–15s)
      const memoryPayload = {
        session_id: sessionId,
        repo_id: 'demo-checkout',
        component: 'checkoutService',
        error: 'Checkout request failed with timeout',
        hypothesis_category: 'payment_api',
        failed_hypotheses: analysisData.ruled_out || [
          { hypothesis: 'The database connection is timing out', reason: 'Database query completes successfully' },
          { hypothesis: 'The database connection pool is exhausted', reason: 'Database query completes successfully' },
        ],
        evidence: analysisData.evidence || [
          'Database query completes successfully',
          'Payment API responds after approximately 3.8 seconds',
          'Client timeout is 2 seconds',
        ],
        root_cause: analysisData.root_cause || 'Payment API latency of approximately 3.8 seconds exceeds the checkout client timeout of 2 seconds.',
        fix: analysisData.fix || 'Increase the checkout client timeout from 2 seconds to 5 seconds.',
        verification: 'Checkout test passed',
      }

      await saveMemory(memoryPayload)
      if (demoAbortRef.current) return

      setSession((prev) => ({
        ...prev,
        verification: 'Checkout test passed',
        memorySaveStatus: 'saved',
      }))
      setCurrentStage('memory')

      await safeTimeout(() => {}, 3500)
      if (demoAbortRef.current) return

      // 5. SCENE 5: AGENT B RECALL (15–22s)
      const agentBSessionId = `session-agent-b-${Date.now()}`
      setCurrentStage('agent-b')
      setIsTransferring(true)
      setTimeout(() => setIsTransferring(false), 900)

      const recallRes = await recallMemory({
        repo_id: 'demo-checkout',
        component: 'checkoutService',
        session_id: agentBSessionId,
      })
      if (demoAbortRef.current) return

      setSession((prev) => ({
        ...prev,
        agent: 'B',
        session_id: agentBSessionId,
        recalled_memories: Array.isArray(recallRes.memories)
          ? recallRes.memories
          : [],
      }))

      await safeTimeout(() => {}, 4000)
      if (demoAbortRef.current) return

      // FINAL SUCCESS STATE
      setIsRunningDemo(false)
      setDemoCompleted(true)
    } catch (err) {
      console.error('[RunDemo Error]:', err)
      setDemoError(err.message || 'Demo execution encountered an error.')
      setIsRunningDemo(false)
    }
  }

  // MANUAL DEVELOPER CONTROLS
  function startAgentB() {
    sessionGeneration.current += 1
    setCurrentStage('agent-b')
    setSession((current) => ({
      ...createInitialSession(),
      session_id: `session-agent-b-${Date.now()}`,
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
        loading: { ...current.loading, attempt: true },
        errors: { ...current.errors, attempt: null },
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

        const nextLoopDetected =
          typeof response.loop_detected === 'boolean'
            ? response.loop_detected
            : current.loop_detected

        if (nextLoopDetected) {
          setCurrentStage('loop')
        }

        return {
          ...current,
          attempts: [...current.attempts, recordedAttempt],
          prior_fingerprints: Array.isArray(response.updated_fingerprints)
            ? response.updated_fingerprints
            : current.prior_fingerprints,
          loop_detected: nextLoopDetected,
          loading: { ...current.loading, attempt: false },
          errors: { ...current.errors, attempt: null },
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
          loading: { ...current.loading, attempt: false },
          errors: { ...current.errors, attempt: message },
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
        loading: { ...current.loading, analyze: true },
        errors: { ...current.errors, analyze: null },
      }
    })

    try {
      const response = await analyzeAttempts(payload)

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }

        const analysisData = response.analysis || response
        setCurrentStage('evidence')

        return {
          ...current,
          analysis: analysisData,
          loading: { ...current.loading, analyze: false },
          errors: { ...current.errors, analyze: null },
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
          loading: { ...current.loading, analyze: false },
          errors: { ...current.errors, analyze: message },
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
      errors: { ...current.errors, memory: null },
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
        loading: { ...current.loading, memory: true },
        memorySaveStatus: 'idle',
        errors: { ...current.errors, memory: null },
      }
    })

    try {
      await saveMemory(payload)

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }
        setCurrentStage('memory')
        return {
          ...current,
          loading: { ...current.loading, memory: false },
          memorySaveStatus: 'saved',
          errors: { ...current.errors, memory: null },
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
          loading: { ...current.loading, memory: false },
          memorySaveStatus: 'idle',
          errors: { ...current.errors, memory: message },
        }
      })
      return false
    }
  }

  async function recallForAgentB() {
    if (session.loading.recall) return false

    const requestSessionId = session.session_id
    const requestGeneration = sessionGeneration.current

    setSession((current) => {
      if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
        return current
      }
      return {
        ...current,
        loading: { ...current.loading, recall: true },
        errors: { ...current.errors, recall: null },
      }
    })

    try {
      const response = await recallMemory({
        repo_id: session.repo_id,
        component: session.component,
      })

      setIsTransferring(true)
      setTimeout(() => setIsTransferring(false), 900)
      setCurrentStage('agent-b')

      setSession((current) => {
        if (!isCurrentSession(current, requestSessionId, requestGeneration)) {
          return current
        }
        return {
          ...current,
          agent: 'B',
          recalled_memories: Array.isArray(response.memories)
            ? response.memories
            : [],
          loading: { ...current.loading, recall: false },
          errors: { ...current.errors, recall: null },
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
          loading: { ...current.loading, recall: false },
          errors: { ...current.errors, recall: message },
        }
      })
      return false
    }
  }

  return (
    <div className="workspace-root">
      <Header
        agent={session.agent}
        onLoadDemo={loadDemoScenario}
        onResetDemo={resetDemo}
        onRunDemo={runAutomatedDemo}
        isRunningDemo={isRunningDemo}
        demoCompleted={demoCompleted}
        sseStatus={sseStatus}
      />

      <DemoTimeline
        currentStage={currentStage}
        onSelectStage={(stage) => !isRunningDemo && setCurrentStage(stage)}
      />

      <main className="investigation-grid">
        {/* ZONE 1: LEFT (~260px) - CASE FILE / INCIDENT */}
        <aside className="zone zone--casefile">
          <SessionContext session={session} />
          <CurrentError error={session.error} />
          <AttemptsPanel attempts={session.attempts} />

          {/* DEVELOPER CONTROLS DRAWER (Collapsed during normal demo) */}
          <details className="dev-controls-drawer">
            <summary className="dev-controls-summary font-mono">
              ⚙ Developer Controls
            </summary>
            <div className="dev-controls-body">
              <LoopStatus
                loopDetected={session.loop_detected}
                analyzeLoading={session.loading.analyze}
                analyzeError={session.errors.analyze}
                onAnalyze={analyzeLoop}
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
              <div className="dev-controls-subhead font-mono">
                Manual Attempt
              </div>
              <AttemptForm
                loading={session.loading.attempt}
                error={session.errors.attempt}
                onSubmit={submitAttempt}
              />
            </div>
          </details>
        </aside>

        {/* ZONE 2: CENTER (MAIN STAGE) - DEMO THEATER SCENE */}
        <section className="zone zone--demo-theater">
          <TransferAnimation isTransferring={isTransferring} />
          <DemoStage
            currentStage={currentStage}
            session={session}
            isTransferring={isTransferring}
            onRunDemo={runAutomatedDemo}
            isRunningDemo={isRunningDemo}
            demoError={demoError}
          />
        </section>

        {/* ZONE 3: RIGHT (~260px) - AGENT B */}
        <aside className="zone zone--agentb">
          <AgentPanel
            agent={session.agent}
            recalledMemories={session.recalled_memories}
            recallLoading={session.loading.recall}
            recallError={session.errors.recall}
            onStartAgentB={startAgentB}
            onRecall={recallForAgentB}
            showManualControls={false}
          />
        </aside>
      </main>

      <TelemetryStrip session={session} sseStatus={sseStatus} />
    </div>
  )
}
