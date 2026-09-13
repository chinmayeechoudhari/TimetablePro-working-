// Short codes have no backing column on the backend (Department is just a
// free-text string on AcademicGroup — see backend/app/models/models.py).
// We persist an optional user-entered code per department name in this
// browser's localStorage so it survives reloads without requiring a schema
// change. It is NOT synced across users/devices. Shared between the
// Departments and Subjects pages so the same department shows the same code
// everywhere.
const SHORT_CODE_KEY = 'timetablepro.department_short_codes'

export function loadShortCodes() {
    try { return JSON.parse(localStorage.getItem(SHORT_CODE_KEY) || '{}') } catch { return {} }
}

export function saveShortCode(name, code) {
    const map = loadShortCodes()
    if (code) map[name] = code; else delete map[name]
    localStorage.setItem(SHORT_CODE_KEY, JSON.stringify(map))
}

export function deriveShortCode(name) {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (!words.length) return ''
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
    return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

const ACCENTS = 6
export function accentIndex(name) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
    return hash % ACCENTS
}