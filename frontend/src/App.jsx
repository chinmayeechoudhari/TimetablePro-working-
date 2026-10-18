import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import LandingScreen from './components/LandingScreen'
import StatusDashboard from './components/StatusDashboard.jsx'
import ChatBubble from './components/ChatBubble.jsx'

// Lazy-load non-dashboard routes to keep initial bundle small and fast
const RoomForm = lazy(() => import('./components/RoomForm.jsx'))
const TimeSlotForm = lazy(() => import('./components/TimeSlotForm.jsx'))
const TeacherAvailabilityForm = lazy(() => import('./components/TeacherAvailabilityForm.jsx'))
const GenerateTimetable = lazy(() => import('./components/GenerateTimetable.jsx'))
const TimetableGrid = lazy(() => import('./components/TimetableGrid.jsx'))
const ConstraintsPage = lazy(() => import('./pages/ConstraintsPage.jsx'))
const AcademicStructure = lazy(() => import('./components/AcademicStructureV2.jsx'))
const AcademicLegacyCleanup = lazy(() => import('./components/AcademicLegacyCleanup.jsx'))
const AcademicSubjects = lazy(() => import('./components/AcademicSubjects.jsx'))
const FacultyAssignments = lazy(() => import('./components/FacultyAssignments.jsx'))
const CalendarPage = lazy(() => import('./components/CalendarPage.jsx'))
const SemesterDashboard = lazy(() => import('./components/SemesterDashboard.jsx'))

import ErrorBoundary from './components/ErrorBoundary.jsx'
import RouteSkeleton from './components/RouteSkeleton.jsx'

function AcademicStructurePage() {
  return (
    <>
      <AcademicStructure />
      <AcademicLegacyCleanup />
    </>
  )
}

export default function App() {
  const [enteredApp, setEnteredApp] = useState(false)

  return (
    <BrowserRouter>
      {!enteredApp && <LandingScreen onEnter={() => setEnteredApp(true)} />}
      <div style={{ display:'flex', height:'100vh', width:'100%', overflow:'hidden', background:'var(--bg-page)', fontFamily:"'Inter','Segoe UI',sans-serif", opacity:enteredApp?1:0, transition:'opacity .4s ease' }}>
        <Navbar />
        <div className="app-main-scroll" style={{ flex:1, height:'100vh', overflowY:'auto', overflowX:'hidden', background:'var(--bg-page)' }}>
          <ErrorBoundary>
            <Suspense fallback={<RouteSkeleton />}>
              <Routes>
                <Route path="/" element={<StatusDashboard />} />
                <Route path="/academic-structure" element={<AcademicStructurePage />} />
                <Route path="/subjects" element={<AcademicSubjects />} />
                <Route path="/faculty-assignments" element={<FacultyAssignments />} />
                <Route path="/rooms" element={<RoomForm />} />
                <Route path="/timeslots" element={<TimeSlotForm />} />
                <Route path="/teacher-availability" element={<TeacherAvailabilityForm />} />
                <Route path="/constraints" element={<ConstraintsPage />} />
                <Route path="/generate" element={<GenerateTimetable />} />
                <Route path="/timetable" element={<TimetableGrid />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/semester" element={<SemesterDashboard />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
      <ChatBubble />
    </BrowserRouter>
  )
}
