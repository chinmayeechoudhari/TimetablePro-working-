import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, X, Check } from "lucide-react";
import axios from "axios";
import { cn } from "@/lib/utils";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const BASE_URL = 'http://localhost:8000';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ALIAS = {
  mon: 'Monday', monday: 'Monday', modnay: 'Monday', monady: 'Monday', mondy: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday'
};

function editDistance(s1, s2) {
  if (s1 === s2) return 0;
  const m = s1.length, n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export default function AIChatCard({ className, onClose }) {
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "👋 Hello! I'm your AI Timetable Assistant. Ask me to manage teacher availability (e.g. *'Prof. Sharma is not available on Monday'*), check **Workload & Conflicts**, or view **Room Occupancy**!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchContextData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
      ]);
      setTeachers(tRes.data || []);
      setTimeslots(sRes.data || []);
      setAvailabilities(aRes.data || []);
      setRooms(rRes.data || []);
      setTimetable(ttRes.data || []);
      setSubjects(subRes.data || []);
      setClasses(cRes.data || []);
    } catch (err) {
      console.warn("Context data load warning:", err);
    }
  }

  function parseAvailabilityQuery(text) {
    const lower = text.toLowerCase().trim();
    const words = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

    let foundDay = null;
    for (const w of words) {
      if (w.length < 3) continue;
      if (DAY_ALIAS[w]) {
        foundDay = DAY_ALIAS[w];
        break;
      }
      for (const d of DAYS) {
        if (w.length >= 4 && editDistance(w, d.toLowerCase()) <= 2) {
          foundDay = d;
          break;
        }
      }
      if (foundDay) break;
    }

    let foundTeacher = null;
    if (teachers && teachers.length > 0) {
      for (const t of teachers) {
        const tNameLower = t.teacher_name.toLowerCase();
        if (lower.includes(tNameLower)) {
          foundTeacher = t;
          break;
        }
        const nameTokens = tNameLower.replace(/prof\.|dr\.|mr\.|mrs\.|ms\./gi, "").trim().split(/\s+/).filter(Boolean);
        for (const tok of nameTokens) {
          if (tok.length >= 3) {
            if (lower.includes(tok)) {
              foundTeacher = t;
              break;
            }
            for (const w of words) {
              if (w.length >= 3 && editDistance(w, tok) <= 1) {
                foundTeacher = t;
                break;
              }
            }
          }
          if (foundTeacher) break;
        }
        if (foundTeacher) break;
      }
    }

    let targetAvailable = null;
    const isUnavail = /not available|not availaible|not avialable|unavailable|unavailaible|absent|off|leave|can't teach|cant teach|no class/i.test(lower);
    const isAvail = /make available|set available|is available|is availaible|mark available|available|availaible|avialable|avaiable|availible|free|can teach|present|on duty/i.test(lower);

    if (isUnavail) {
      targetAvailable = false;
    } else if (isAvail) {
      targetAvailable = true;
    } else if (foundTeacher && foundDay) {
      targetAvailable = true;
    }

    let foundPeriod = null;
    const periodMatch = lower.match(/\bp(\d+)\b|period\s*(\d+)/i);
    if (periodMatch) {
      foundPeriod = parseInt(periodMatch[1] || periodMatch[2]);
    }

    if (foundTeacher && foundDay && targetAvailable !== null) {
      return { teacher: foundTeacher, day: foundDay, period: foundPeriod, targetAvailable };
    }
    return null;
  }

  async function queryGeminiApi(promptText, history) {
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    const systemPrompt = `You are a helpful AI Assistant for an automated College/School Timetable Generator application.
    Current Teachers in system: ${teachers.map(t => t.teacher_name).join(", ") || "None"}.
    Available Days: Monday to Saturday.
    You can help users manage teacher availability (setting teachers to AVAILABLE or UNAVAILABLE), analyze workload & conflicts, check room occupancy, explain timetable generation, or check schedules.
    Be concise, helpful, friendly, and professional.`;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const contents = [
          ...history.slice(-4).map(m => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.text }]
          })),
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ];

        const response = await axios.post(url, {
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] }
        }, { headers: { "Content-Type": "application/json" } });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return response.data.candidates[0].content.parts[0].text;
        }
      } catch (e) {
        console.warn(`Gemini API call failed with model ${model}:`, e?.response?.data || e.message);
      }
    }
    return null;
  }

  async function applyAvailability(teacherId, teacherName, day, period, targetAvailable) {
    try {
      let targetSlots = [];
      if (period) {
        targetSlots = timeslots.filter(s => s.day.toLowerCase() === day.toLowerCase() && s.period_number === period);
      } else {
        targetSlots = timeslots.filter(s => s.day.toLowerCase() === day.toLowerCase());
      }

      if (targetSlots.length === 0) {
        return `I couldn't find configured timeslots for ${day}${period ? ` Period ${period}` : ""}. Please verify timeslot setup first.`;
      }

      let updatedCount = 0;
      for (const slot of targetSlots) {
        const existing = availabilities.find(a => a.teacher_id === teacherId && a.slot_id === slot.slot_id);

        if (targetAvailable) {
          if (existing) {
            await axios.delete(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`).catch(async () => {
              await axios.put(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`, { is_available: true }).catch(() => {});
            });
            updatedCount++;
          }
        } else {
          await axios.post(`${BASE_URL}/teacher-availabilities`, {
            teacher_id: teacherId,
            slot_id: slot.slot_id,
            is_available: false
          }).catch(async (err) => {
            console.warn("POST failed, attempting PUT fallback:", err);
            await axios.put(`${BASE_URL}/teacher-availabilities/${teacherId}/${slot.slot_id}`, {
              is_available: false
            }).catch(putErr => console.error("PUT failed:", putErr));
          });
          updatedCount++;
        }
      }

      fetchContextData();
      window.dispatchEvent(new CustomEvent("availabilityUpdated", { detail: { teacherId, day } }));

      const periodLabel = period ? ` Period ${period}` : "";
      if (targetAvailable) {
        return `Done! I have updated **${teacherName}** to be **AVAILABLE** on **${day}${periodLabel}**. You can now go to the **Generate** tab to re-run the solver.`;
      } else {
        return `Done! I have marked **${teacherName}** as **UNAVAILABLE** on **${day}${periodLabel}** (${updatedCount} slot rule updated). You can now go to the **Generate** tab to re-run the solver.`;
      }
    } catch (err) {
      console.error("Error applying availability:", err);
      return `Failed to update availability on backend. Detail: ${err?.response?.data?.detail || err.message}`;
    }
  }

  function getWorkloadAndConflictSummary() {
    if (!timetable || timetable.length === 0) {
      return "📊 **Teacher Workload & Conflict Analyzer**:\nNo timetable entries generated yet! Please go to the **Generate** tab and generate a timetable first.";
    }

    const teacherCountMap = {};
    const teacherDayMap = {};
    const conflicts = [];

    const unavailableSet = new Set(
      availabilities.filter(a => !a.is_available).map(a => `${a.teacher_id}_${a.slot_id}`)
    );

    timetable.forEach(entry => {
      const tId = entry.teacher_id;
      teacherCountMap[tId] = (teacherCountMap[tId] || 0) + 1;

      const slot = timeslots.find(s => s.slot_id === entry.slot_id);
      if (slot) {
        if (!teacherDayMap[tId]) teacherDayMap[tId] = {};
        teacherDayMap[tId][slot.day] = (teacherDayMap[tId][slot.day] || 0) + 1;
      }

      if (unavailableSet.has(`${tId}_${entry.slot_id}`)) {
        const teacherObj = teachers.find(t => t.teacher_id === tId);
        const tName = teacherObj ? teacherObj.teacher_name : `Teacher ${tId}`;
        const slotLabel = slot ? `${slot.day} P${slot.period_number}` : `Slot ${entry.slot_id}`;
        conflicts.push(`⚠️ **${tName}** is assigned on **${slotLabel}** despite an unavailability rule.`);
      }
    });

    let text = "📊 **Teacher Workload Summary**:\n\n";
    teachers.forEach(t => {
      const count = teacherCountMap[t.teacher_id] || 0;
      const days = teacherDayMap[t.teacher_id] || {};
      let busiestDay = "N/A";
      let maxD = 0;
      Object.entries(days).forEach(([d, num]) => {
        if (num > maxD) { maxD = num; busiestDay = `${d} (${num} periods)`; }
      });

      text += `• **${t.teacher_name}**: ${count} total period(s) | Peak: ${busiestDay}\n`;
    });

    if (conflicts.length > 0) {
      text += `\n🚨 **Conflicts Detected (${conflicts.length})**:\n` + conflicts.join("\n");
    } else {
      text += `\n✅ **Conflicts**: No scheduling conflicts detected!`;
    }

    return text;
  }

  function getRoomOccupancySummary(inputQuery) {
    if (!rooms || rooms.length === 0) {
      return "🏢 **Room Occupancy**: No rooms configured yet.";
    }

    const lower = inputQuery.toLowerCase();
    let targetDay = "Monday";
    const words = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    for (const w of words) {
      if (DAY_ALIAS[w]) {
        targetDay = DAY_ALIAS[w];
        break;
      }
    }

    let targetPeriod = null;
    const periodMatch = lower.match(/\bp(\d+)\b|period\s*(\d+)/i);
    if (periodMatch) {
      targetPeriod = parseInt(periodMatch[1] || periodMatch[2]);
    }

    if (targetPeriod) {
      const slot = timeslots.find(s => s.day.toLowerCase() === targetDay.toLowerCase() && s.period_number === targetPeriod);
      if (!slot) {
        return `🏢 **Room Occupancy**: Could not find Period ${targetPeriod} for ${targetDay}.`;
      }

      const occupiedSlotEntries = timetable.filter(e => e.slot_id === slot.slot_id);
      const occupiedRoomIds = new Set(occupiedSlotEntries.map(e => e.room_id));

      const occupiedList = [];
      const freeList = [];

      rooms.forEach(r => {
        if (occupiedRoomIds.has(r.room_id)) {
          const entry = occupiedSlotEntries.find(e => e.room_id === r.room_id);
          const subObj = subjects.find(s => s.subject_id === entry?.subject_id);
          const clsObj = classes.find(c => c.class_id === entry?.class_id);
          occupiedList.push(`🔴 **${r.room_number}**: ${clsObj?.class_name || "Class"} (${subObj?.subject_name || "Subject"})`);
        } else {
          freeList.push(`🟢 **${r.room_number}** (${r.room_type || 'classroom'})`);
        }
      });

      return `🏢 **Room Occupancy for ${targetDay} Period ${targetPeriod}**:\n\n` +
        `**Vacant / Free Rooms (${freeList.length})**:\n${freeList.join("\n") || "None"}\n\n` +
        `**Occupied Rooms (${occupiedList.length})**:\n${occupiedList.join("\n") || "None"}`;
    } else {
      const daySlots = timeslots.filter(s => s.day.toLowerCase() === targetDay.toLowerCase());
      if (daySlots.length === 0) {
        return `🏢 **Room Occupancy**: No timeslots configured for ${targetDay}.`;
      }

      let text = `🏢 **Room Occupancy Overview for ${targetDay}**:\n\n`;
      rooms.forEach(r => {
        const assignedSlots = timetable.filter(e => e.room_id === r.room_id && daySlots.some(ds => ds.slot_id === e.slot_id));
        text += `• **${r.room_number}** (${r.room_type || 'classroom'}): ${assignedSlots.length} / ${daySlots.length} periods occupied\n`;
      });
      text += `\n💡 *Tip: Try asking "Which room is free on ${targetDay} Period 1?" for period availability.*`;
      return text;
    }
  }

  const handleSend = async (overrideText) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim()) return;

    const userMsg = { sender: "user", text: textToSend, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setIsTyping(true);

    const lower = textToSend.trim().toLowerCase();

    // 1. Pending action confirmation
    if (pendingAction) {
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|confirm|do it|true|y|correct|please)$/i.test(lower) || lower.includes("yes") || lower.includes("sure") || lower.includes("ok");
      const isNegative = /^(no|nope|nah|cancel|don't|dont|false|n|stop)$/i.test(lower) || lower.includes("no") || lower.includes("cancel");

      if (isAffirmative) {
        const botReplyText = await applyAvailability(
          pendingAction.teacherId,
          pendingAction.teacherName,
          pendingAction.day,
          pendingAction.period,
          pendingAction.targetAvailable
        );

        setMessages((prev) => [...prev, { sender: "ai", text: botReplyText, id: Date.now() + 1 }]);
        setPendingAction(null);
        setIsTyping(false);
        return;
      } else if (isNegative) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Understood, decision reconsidered and action cancelled! I haven't modified the availability for ${pendingAction.teacherName}. What would you like me to do instead?`,
            id: Date.now() + 1,
          },
        ]);
        setPendingAction(null);
        setIsTyping(false);
        return;
      } else {
        const periodText = pendingAction.period ? ` Period ${pendingAction.period}` : "";
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `I have a pending action: change availability of **${pendingAction.teacherName}** on **${pendingAction.day}${periodText}** to **${pendingAction.targetAvailable ? "AVAILABLE" : "UNAVAILABLE"}**. Reply **Yes** to confirm or **No** to cancel.`,
            id: Date.now() + 1,
          },
        ]);
        setIsTyping(false);
        return;
      }
    }

    // 2. Workload & Conflict query
    if (/workload|teacher load|busiest teacher|check conflict|conflicts|highest load/i.test(lower)) {
      const summaryText = getWorkloadAndConflictSummary();
      setMessages((prev) => [...prev, { sender: "ai", text: summaryText, id: Date.now() + 1 }]);
      setIsTyping(false);
      return;
    }

    // 3. Room Occupancy query
    if (/room|occupancy|vacant|free room|empty room/i.test(lower)) {
      const summaryText = getRoomOccupancySummary(textToSend);
      setMessages((prev) => [...prev, { sender: "ai", text: summaryText, id: Date.now() + 1 }]);
      setIsTyping(false);
      return;
    }

    // 4. Availability query
    const parsedQuery = parseAvailabilityQuery(textToSend);
    if (parsedQuery) {
      const { teacher, day, period, targetAvailable } = parsedQuery;
      setPendingAction({
        type: "CHANGE_AVAILABILITY",
        teacherId: teacher.teacher_id,
        teacherName: teacher.teacher_name,
        day: day,
        period: period,
        targetAvailable: targetAvailable
      });

      const statusWord = targetAvailable ? "AVAILABLE" : "UNAVAILABLE";
      const periodText = period ? ` Period ${period}` : "";
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Do you want me to change the availability of **${teacher.teacher_name}** on **${day}${periodText}** to **${statusWord}**?`,
          id: Date.now() + 1,
        },
      ]);
      setIsTyping(false);
      return;
    }

    // 5. Gemini API query with smart fallback
    const geminiResponse = await queryGeminiApi(textToSend, messages);

    let finalBotText = geminiResponse;
    if (!finalBotText) {
      if (lower.includes("teacher") || lower.includes("availability")) {
        finalBotText = `To manage teacher availability, say e.g. *"Prof. Sharma is not available on Monday"* or navigate to Teacher Availability.`;
      } else if (lower.includes("generate") || lower.includes("solve")) {
        finalBotText = `To generate a timetable, click on **Generate** in the sidebar and hit **Generate Timetable**!`;
      } else {
        finalBotText = `I'm here to help manage your timetable! You can ask me to update teacher availability, check **Workload & Conflicts**, or view **Room Occupancy**.`;
      }
    }

    setMessages((prev) => [...prev, { sender: "ai", text: finalBotText, id: Date.now() + 1 }]);
    setIsTyping(false);
  };

  return (
    <div className={cn("relative w-[380px] h-[520px] max-h-[calc(100vh-100px)] rounded-2xl overflow-hidden p-[2px] shadow-2xl", className)}>
      {/* Animated Outer Border */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner Card */}
      <div className="relative flex flex-col w-full h-full rounded-xl border border-white/15 overflow-hidden bg-slate-950/95 backdrop-blur-xl">
        {/* Inner Animated Background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "200% 200%" }}
        />

        {/* Floating Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/15"
            animate={{
              y: ["0%", "-140%"],
              x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
            style={{ left: `${Math.random() * 100}%`, bottom: "-10%" }}
          />
        ))}

        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 relative z-10 flex items-center justify-between bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">Timetable AI</h2>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Gemini Powered
              </span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages Container */}
        <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 text-xs flex flex-col relative z-10">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "px-3.5 py-2.5 rounded-xl max-w-[85%] shadow-md backdrop-blur-md whitespace-pre-line leading-relaxed",
                msg.sender === "ai"
                  ? "bg-white/10 text-slate-100 border border-white/10 self-start rounded-tl-none"
                  : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium self-end rounded-tr-none"
              )}
            >
              {msg.text}
            </motion.div>
          ))}

          {/* AI Typing Indicator */}
          {isTyping && (
            <motion.div
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl max-w-[30%] bg-white/10 text-white self-start border border-white/10 rounded-tl-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce delay-150"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce delay-300"></span>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggest Chips & Action Buttons */}
        <div className="relative z-10 px-3 py-1.5 border-t border-white/10 bg-black/40 backdrop-blur-md">
          {pendingAction ? (
            <div className="flex gap-2 py-1">
              <button
                onClick={() => handleSend("Yes")}
                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5" /> Yes, update
              </button>
              <button
                onClick={() => handleSend("No")}
                className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md"
              >
                <X className="w-3.5 h-3.5" /> No, cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar text-[11px] whitespace-nowrap">
              <button
                onClick={() => handleSend("Teacher workload summary")}
                className="px-2.5 py-1 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 transition-colors"
              >
                📊 Workload Summary
              </button>
              <button
                onClick={() => handleSend("Which rooms are free on Monday Period 1?")}
                className="px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 transition-colors"
              >
                🏢 Free Rooms Mon P1
              </button>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 p-3 border-t border-white/10 relative z-10 bg-slate-950/80">
          <input
            className="flex-1 px-3 py-2 text-xs bg-white/5 rounded-lg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            placeholder={pendingAction ? "Type 'Yes' or 'No'..." : "Ask e.g. Prof. Sharma off Mon P2..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={() => handleSend()}
            className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 transition-opacity text-white shadow-md flex items-center justify-center"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
