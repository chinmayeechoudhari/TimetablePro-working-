import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const BASE_URL = 'http://localhost:8000'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ALIAS = {
  mon: 'Monday', monday: 'Monday', modnay: 'Monday', monady: 'Monday', mondy: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday'
}

function editDistance(s1, s2) {
  if (s1 === s2) return 0
  const m = s1.length, n = s2.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

/* ── Markdown-lite renderer ── */
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

/* ── Icons ── */
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const SparkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8L4.3 10.7l5.8-1.9z"/><path d="M5 3l.9 2.8L8.7 6.7l-2.8.9L5 10.4l-.9-2.8L1.3 6.7l2.8-.9z"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([{
    id: 1, sender: 'bot',
    text: "👋 Hello! I'm your **Timetable AI Assistant**. You can ask me to manage teacher availability (e.g. *'Prof. Sharma is not available on Monday'*), check **Workload & Conflicts**, or view **Room Occupancy**!",
  }])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const [teachers, setTeachers] = useState([])
  const [timeslots, setTimeslots] = useState([])
  const [availabilities, setAvailabilities] = useState([])
  const [rooms, setRooms] = useState([])
  const [timetable, setTimetable] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { fetchContextData() }, [])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  async function fetchContextData() {
    try {
      const [tRes, sRes, aRes, rRes, ttRes, subRes, cRes] = await Promise.all([
        axios.get(`${BASE_URL}/teachers`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/timeslots`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/teacher-availabilities`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/rooms`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/timetable`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/subjects`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/classes`).catch(() => ({ data: [] }))
      ])
      setTeachers(tRes.data || [])
      setTimeslots(sRes.data || [])
      setAvailabilities(aRes.data || [])
      setRooms(rRes.data || [])
      setTimetable(ttRes.data || [])
      setSubjects(subRes.data || [])
      setClasses(cRes.data || [])
    } catch (err) { console.warn('Context data load warning:', err) }
  }

  function parseAvailabilityQuery(text) {
    const lower = text.toLowerCase().trim()
    const words = lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)

    let foundDay = null
    for (const w of words) {
      if (w.length < 3) continue
      if (DAY_ALIAS[w]) { foundDay = DAY_ALIAS[w]; break }
      for (const d of DAYS) {
        if (w.length >= 4 && editDistance(w, d.toLowerCase()) <= 2) { foundDay = d; break }
      }
      if (foundDay) break
    }

    let foundTeacher = null
    if (teachers && teachers.length > 0) {
      for (const t of teachers) {
        const tNameLower = t.teacher_name.toLowerCase()
        if (lower.includes(tNameLower)) { foundTeacher = t; break }
        const nameTokens = tNameLower.replace(/prof\.|dr\.|mr\.|mrs\.|ms\./gi, '').trim().split(/\s+/).filter(Boolean)
        for (const tok of nameTokens) {
          if (tok.length >= 3) {
            if (lower.includes(tok)) { foundTeacher = t; break }
            for (const w of words) {
              if (w.length >= 3 && editDistance(w, tok) <= 1) { foundTeacher = t; break }
            }
          }
          if (foundTeacher) break
        }
        if (foundTeacher) break
      }
    }

    let targetAvailable = null
    const isUnavail = /not available|not availaible|not avialable|unavailable|unavailaible|absent|off|leave|can't teach|cant teach|no class/i.test(lower)
    const isAvail = /make available|set available|is available|is availaible|mark available|available|availaible|avialable|avaiable|availible|free|can teach|present|on duty/i.test(lower)
    if (isUnavail) targetAvailable = false
    else if (isAvail) targetAvailable = true
    else if (foundTeacher && foundDay) targetAvailable = true

    let foundPeriod = null
    const periodMatch = lower.match(/\bp(\d+)\b|period\s*(\d+)/i)
    if (periodMatch) foundPeriod = parseInt(periodMatch[1] || periodMatch[2])

    if (foundTeacher && foundDay && targetAvailable !== null)
      return { teacher: foundTeacher, day: foundDay, period: foundPeriod, targetAvailable }
    return null
  }

  async function queryGeminiApi(promptText, history) {
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    const systemPrompt = `You are a helpful AI Assistant for an automated College/School Timetable Generator application.
    Current Teachers in system: ${teachers.map(t => t.teacher_name).join(', ') || 'None'}.
    Available Days: Monday to Saturday.
    You can help users manage teacher availability (setting teachers to AVAILABLE or UNAVAILABLE), analyze workload & conflicts, check room occupancy, explain timetable generation, or check schedules.
    Be concise, helpful, friendly, and professional.`

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
        const contents = [
          ...history.slice(-4).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: promptText }] }
        ]
        const response = await axios.post(url, {
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] }
        }, { headers: { 'Content-Type': 'application/json' } })
        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text)
          return response.data.candidates[0].content.parts[0].text
      } catch (e) { console.warn(`Gemini ${model} failed:`, e?.response?.data || e.message) }
    }
    return null
  }

  async function applyAvailability(teacherId, teacherName, day, period, targetAvailable) {
    try {
      let targetSlots = period
        ? timeslots.filter(s => s.day.toLowerCase() === day.toLowerCase() && s.period_number === period)
        : timeslots.filter(s => s.day.toLowerCase() === day.toLowerCase())

      if (targetSlots.length === 0)
        return `I couldn't find configured timeslots for ${day}${period ? ` Period ${period}` : ''}. Please verify timeslot setup first.`

      let updatedCount = 0
      for (const slot of targetSlots) {
        const existing = availabilities.find(a => a.teacher_id === teacherId && a.slot_id === slot.slot_id)
        if (targetAvailable) {
          if (existing) {
            await axios.delete(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`).catch(async () => {
              await axios.put(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`, { is_available: true }).catch(() => {})
            })
            updatedCount++
          }
        } else {
          await axios.post(`${BASE_URL}/teacher-availabilities`, {
            teacher_id: teacherId, slot_id: slot.slot_id, is_available: false
          }).catch(async (err) => {
            await axios.put(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`, { is_available: false }).catch(() => {})
          })
          updatedCount++
        }
      }

      fetchContextData()
      window.dispatchEvent(new CustomEvent('availabilityUpdated', { detail: { teacherId, day } }))

      const periodLabel = period ? ` Period ${period}` : ''
      return targetAvailable
        ? `✅ Done! **${teacherName}** is now **AVAILABLE** on **${day}${periodLabel}**. Head to the **Generate** tab to re-run the solver.`
        : `✅ Done! **${teacherName}** marked as **UNAVAILABLE** on **${day}${periodLabel}** (${updatedCount} slot(s) updated). Head to the **Generate** tab to re-run the solver.`
    } catch (err) {
      return `Failed to update availability. Detail: ${err?.response?.data?.detail || err.message}`
    }
  }

  function getWorkloadSummary() {
    if (!timetable || timetable.length === 0)
      return '📊 **Teacher Workload & Conflict Analyzer**:\nNo timetable generated yet! Go to the **Generate** tab first.'
    const teacherCountMap = {}, teacherDayMap = {}, conflicts = []
    const unavailableSet = new Set(availabilities.filter(a => !a.is_available).map(a => `${a.teacher_id}_${a.slot_id}`))
    timetable.forEach(entry => {
      const tId = entry.teacher_id
      teacherCountMap[tId] = (teacherCountMap[tId] || 0) + 1
      const slot = timeslots.find(s => s.slot_id === entry.slot_id)
      if (slot) {
        if (!teacherDayMap[tId]) teacherDayMap[tId] = {}
        teacherDayMap[tId][slot.day] = (teacherDayMap[tId][slot.day] || 0) + 1
      }
      if (unavailableSet.has(`${tId}_${entry.slot_id}`)) {
        const teacherObj = teachers.find(t => t.teacher_id === tId)
        const tName = teacherObj ? teacherObj.teacher_name : `Teacher ${tId}`
        const slotLabel = slot ? `${slot.day} P${slot.period_number}` : `Slot ${entry.slot_id}`
        conflicts.push(`⚠️ **${tName}** scheduled on **${slotLabel}** despite unavailability rule.`)
      }
    })
    let text = '📊 **Teacher Workload Summary**:\n\n'
    teachers.forEach(t => {
      const count = teacherCountMap[t.teacher_id] || 0
      const days = teacherDayMap[t.teacher_id] || {}
      let busiestDay = 'N/A', maxD = 0
      Object.entries(days).forEach(([d, num]) => { if (num > maxD) { maxD = num; busiestDay = `${d} (${num} periods)` } })
      text += `• **${t.teacher_name}**: ${count} total period(s) | Peak: ${busiestDay}\n`
    })
    text += conflicts.length > 0
      ? `\n🚨 **Conflicts (${conflicts.length})**:\n` + conflicts.join('\n')
      : '\n✅ **No scheduling conflicts detected!**'
    return text
  }

  function getRoomOccupancy(inputQuery) {
    if (!rooms || rooms.length === 0) return '🏢 **Room Occupancy**: No rooms configured yet.'
    const lower = inputQuery.toLowerCase()
    let targetDay = 'Monday'
    for (const w of lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
      if (DAY_ALIAS[w]) { targetDay = DAY_ALIAS[w]; break }
    }
    let targetPeriod = null
    const pm = lower.match(/\bp(\d+)\b|period\s*(\d+)/i)
    if (pm) targetPeriod = parseInt(pm[1] || pm[2])

    if (targetPeriod) {
      const slot = timeslots.find(s => s.day.toLowerCase() === targetDay.toLowerCase() && s.period_number === targetPeriod)
      if (!slot) return `🏢 Could not find Period ${targetPeriod} for ${targetDay}.`
      const occupiedEntries = timetable.filter(e => e.slot_id === slot.slot_id)
      const occupiedIds = new Set(occupiedEntries.map(e => e.room_id))
      const freeList = [], occupiedList = []
      rooms.forEach(r => {
        if (occupiedIds.has(r.room_id)) {
          const entry = occupiedEntries.find(e => e.room_id === r.room_id)
          const subObj = subjects.find(s => s.subject_id === entry?.subject_id)
          const clsObj = classes.find(c => c.class_id === entry?.class_id)
          occupiedList.push(`🔴 **${r.room_number}**: ${clsObj?.class_name || 'Class'} (${subObj?.subject_name || 'Subject'})`)
        } else { freeList.push(`🟢 **${r.room_number}** (${r.room_type || 'classroom'})`) }
      })
      return `🏢 **Room Occupancy — ${targetDay} Period ${targetPeriod}**:\n\nFree (${freeList.length}):\n${freeList.join('\n') || 'None'}\n\nOccupied (${occupiedList.length}):\n${occupiedList.join('\n') || 'None'}`
    } else {
      const daySlots = timeslots.filter(s => s.day.toLowerCase() === targetDay.toLowerCase())
      if (!daySlots.length) return `🏢 No timeslots configured for ${targetDay}.`
      let text = `🏢 **Room Occupancy — ${targetDay}**:\n\n`
      rooms.forEach(r => {
        const count = timetable.filter(e => e.room_id === r.room_id && daySlots.some(ds => ds.slot_id === e.slot_id)).length
        text += `• **${r.room_number}** (${r.room_type || 'classroom'}): ${count}/${daySlots.length} periods occupied\n`
      })
      text += `\n💡 Try "Which rooms are free on ${targetDay} Period 1?" for details.`
      return text
    }
  }

  const addBotMessage = (text) => setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text }])

  const handleSend = async (overrideText) => {
    const text = (overrideText || inputValue).trim()
    if (!text) return
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text }])
    if (!overrideText) setInputValue('')
    setIsTyping(true)
    const lower = text.toLowerCase()

    // 1. Pending confirmation
    if (pendingAction) {
      const yes = /^(yes|yeah|yep|sure|ok|okay|confirm|do it|y|correct|please)$/i.test(lower) || lower.includes('yes') || lower.includes('sure') || lower.includes('ok')
      const no = /^(no|nope|nah|cancel|don't|dont|n|stop)$/i.test(lower) || lower.includes('no') || lower.includes('cancel')
      if (yes) {
        const reply = await applyAvailability(pendingAction.teacherId, pendingAction.teacherName, pendingAction.day, pendingAction.period, pendingAction.targetAvailable)
        addBotMessage(reply)
        setPendingAction(null)
      } else if (no) {
        addBotMessage(`Understood! Action cancelled. I haven't modified anything for ${pendingAction.teacherName}. How can I help you?`)
        setPendingAction(null)
      } else {
        const pText = pendingAction.period ? ` Period ${pendingAction.period}` : ''
        addBotMessage(`I still have a pending action: change **${pendingAction.teacherName}** on **${pendingAction.day}${pText}** to **${pendingAction.targetAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}**. Reply **Yes** to confirm or **No** to cancel.`)
      }
      setIsTyping(false)
      return
    }

    // 2. Workload
    if (/workload|teacher load|busiest|conflicts|highest load/i.test(lower)) {
      addBotMessage(getWorkloadSummary())
      setIsTyping(false)
      return
    }

    // 3. Room occupancy
    if (/room|occupancy|vacant|free room|empty room/i.test(lower)) {
      addBotMessage(getRoomOccupancy(text))
      setIsTyping(false)
      return
    }

    // 4. Availability
    const parsed = parseAvailabilityQuery(text)
    if (parsed) {
      const { teacher, day, period, targetAvailable } = parsed
      setPendingAction({ teacherId: teacher.teacher_id, teacherName: teacher.teacher_name, day, period, targetAvailable })
      const statusWord = targetAvailable ? 'AVAILABLE' : 'UNAVAILABLE'
      const pText = period ? ` Period ${period}` : ''
      addBotMessage(`Do you want me to change the availability of **${teacher.teacher_name}** on **${day}${pText}** to **${statusWord}**?`)
      setIsTyping(false)
      return
    }

    // 5. Gemini
    const geminiResponse = await queryGeminiApi(text, messages)
    addBotMessage(geminiResponse || "I'm here to help manage your timetable! Ask me to update teacher availability, check **Workload & Conflicts**, or view **Room Occupancy**.")
    setIsTyping(false)
  }

  /* ── Styles ── */
  const S = {
    /* Floating button */
    fab: {
      position: 'fixed', bottom: '28px', right: '28px', zIndex: 99999,
      width: '52px', height: '52px', borderRadius: '16px', border: 'none',
      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45), 0 2px 8px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease',
    },
    fabHover: { transform: 'scale(1.08)', boxShadow: '0 12px 32px rgba(37, 99, 235, 0.55)' },
    fabActive: { transform: 'scale(0.94) rotate(90deg)' },

    /* Popup window */
    popup: {
      position: 'fixed', bottom: '92px', right: '28px', zIndex: 99998,
      width: '380px',
      height: '540px',
      borderRadius: '16px',
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #E2E8F0)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      overflow: 'hidden',
      // Animation
      transformOrigin: 'bottom right',
      animation: isOpen ? 'chatPopIn 0.22s cubic-bezier(.34,1.56,.64,1) forwards' : 'chatPopOut 0.15s ease forwards',
    },

    /* Header (matches sidebar dark) */
    header: {
      background: '#0a1633',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    headerIcon: {
      width: '34px', height: '34px', borderRadius: '10px',
      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
    },
    headerTitle: { fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '-0.2px' },
    headerSub: { fontSize: '11px', color: '#3b82f6', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' },
    headerDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' },
    closeBtn: {
      width: '28px', height: '28px', borderRadius: '8px', border: 'none',
      background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.15s, color 0.15s',
    },

    /* Messages area */
    msgs: {
      flex: 1, overflowY: 'auto', padding: '14px 14px 6px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    },

    /* Bot bubble */
    botBubble: {
      alignSelf: 'flex-start', maxWidth: '82%',
      background: 'var(--bg-page, #F0F4F8)',
      color: 'var(--text-main, #1B2A3B)',
      border: '1px solid var(--border-color, #E2E8F0)',
      borderRadius: '12px 12px 12px 3px',
      padding: '10px 13px', fontSize: '12.5px', lineHeight: '1.55',
      wordBreak: 'break-word',
    },

    /* User bubble */
    userBubble: {
      alignSelf: 'flex-end', maxWidth: '82%',
      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      color: '#fff',
      borderRadius: '12px 12px 3px 12px',
      padding: '10px 13px', fontSize: '12.5px', lineHeight: '1.55',
      wordBreak: 'break-word',
    },

    /* Typing indicator */
    typing: {
      alignSelf: 'flex-start',
      background: 'var(--bg-page, #F0F4F8)',
      border: '1px solid var(--border-color, #E2E8F0)',
      borderRadius: '12px 12px 12px 3px',
      padding: '10px 14px', display: 'flex', gap: '5px', alignItems: 'center',
    },
    dot: { width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6' },

    /* Quick chips */
    chips: {
      padding: '8px 12px',
      borderTop: '1px solid var(--border-color, #E2E8F0)',
      display: 'flex', gap: '6px', overflowX: 'auto', flexShrink: 0,
    },
    chip: {
      padding: '5px 11px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '500',
      background: 'var(--bg-page, #F0F4F8)',
      border: '1px solid var(--border-color, #E2E8F0)',
      color: 'var(--text-main, #1B2A3B)',
      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s, border-color 0.15s',
    },
    chipYes: {
      padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
      background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center',
      transition: 'opacity 0.15s',
    },
    chipNo: {
      padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
      background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '5px', flex: 1, justifyContent: 'center',
      transition: 'opacity 0.15s',
    },

    /* Input bar */
    inputBar: {
      padding: '10px 12px',
      borderTop: '1px solid var(--border-color, #E2E8F0)',
      display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0,
    },
    input: {
      flex: 1, border: '1px solid var(--input-border, #CBD5E1)',
      borderRadius: '10px', padding: '9px 13px', fontSize: '13px',
      background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #1B2A3B)',
      outline: 'none', fontFamily: "'Inter', 'Segoe UI', sans-serif",
      transition: 'border-color 0.15s',
    },
    sendBtn: {
      width: '38px', height: '38px', borderRadius: '10px', border: 'none',
      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 3px 10px rgba(37,99,235,0.3)', transition: 'opacity 0.15s',
      flexShrink: 0,
    },
  }

  const [fabHovered, setFabHovered] = useState(false)

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes chatPopIn {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes chatPopOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to   { opacity: 0; transform: scale(0.88) translateY(12px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        .chat-dot-1 { animation: dotBounce 1.3s infinite 0s; }
        .chat-dot-2 { animation: dotBounce 1.3s infinite 0.18s; }
        .chat-dot-3 { animation: dotBounce 1.3s infinite 0.36s; }
        .chat-msgs::-webkit-scrollbar { width: 4px; }
        .chat-msgs::-webkit-scrollbar-track { background: transparent; }
        .chat-msgs::-webkit-scrollbar-thumb { background: var(--border-color, #E2E8F0); border-radius: 4px; }
        .chat-chip:hover { background: #eff6ff !important; border-color: #2563eb !important; color: #2563eb !important; }
        .chat-close:hover { background: rgba(255,255,255,0.15) !important; color: #fff !important; }
        .chat-send:hover { opacity: 0.88; }
        .chat-input:focus { border-color: #2563eb !important; }
        .chat-yes:hover { opacity: 0.88; }
        .chat-no:hover { opacity: 0.88; }
      `}</style>

      {/* Popup Window */}
      {isOpen && (
        <div style={S.popup}>
          {/* Header */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <div style={S.headerIcon}>
                <SparkIcon />
              </div>
              <div>
                <div style={S.headerTitle}>Timetable AI</div>
                <div style={S.headerSub}>
                  <span style={S.headerDot} />
                  Gemini Powered
                </div>
              </div>
            </div>
            <button style={S.closeBtn} className="chat-close" onClick={() => setIsOpen(false)}>
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div style={S.msgs} className="chat-msgs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={msg.sender === 'bot' ? S.botBubble : S.userBubble}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
              />
            ))}
            {isTyping && (
              <div style={S.typing}>
                <span style={S.dot} className="chat-dot-1" />
                <span style={S.dot} className="chat-dot-2" />
                <span style={S.dot} className="chat-dot-3" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Confirmation / Quick Chips */}
          <div style={S.chips}>
            {pendingAction ? (
              <>
                <button style={S.chipYes} className="chat-yes" onClick={() => handleSend('Yes')}>
                  <CheckIcon /> Yes, update
                </button>
                <button style={S.chipNo} className="chat-no" onClick={() => handleSend('No')}>
                  <CloseIcon /> No, cancel
                </button>
              </>
            ) : (
              <>
                <button style={S.chip} className="chat-chip" onClick={() => handleSend('Teacher workload summary')}>📊 Workload</button>
                <button style={S.chip} className="chat-chip" onClick={() => handleSend('Which rooms are free on Monday Period 1?')}>🏢 Rooms Mon P1</button>
                <button style={S.chip} className="chat-chip" onClick={() => handleSend('Any scheduling conflicts?')}>⚠️ Conflicts</button>
              </>
            )}
          </div>

          {/* Input */}
          <div style={S.inputBar}>
            <input
              ref={inputRef}
              style={S.input}
              className="chat-input"
              placeholder={pendingAction ? "Type 'Yes' or 'No'…" : 'Ask about teachers, rooms, schedule…'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button style={S.sendBtn} className="chat-send" onClick={() => handleSend()}>
              <SendIcon />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button with label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
        {!isOpen && (
          <span style={{
            fontSize: '12.5px',
            fontWeight: '600',
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>Ask AI Assistant</span>
        )}
        <button
          style={{
            ...S.fab,
            ...(fabHovered ? S.fabHover : {}),
            ...(isOpen ? { ...S.fabActive, background: '#1e293b' } : {}),
            borderRadius: '50%',
          }}
          onMouseEnter={() => setFabHovered(true)}
          onMouseLeave={() => setFabHovered(false)}
          onClick={() => setIsOpen(v => !v)}
          title="AI Timetable Assistant"
        >
          {isOpen
            ? <CloseIcon />
            : <SparkIcon />
          }
        </button>
      </div>
    </>
  )
}
