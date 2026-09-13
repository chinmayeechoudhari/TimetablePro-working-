import { useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import LandingScreen from './components/LandingScreen'
import StatusDashboard from './components/StatusDashboard.jsx'
import ChatBubble from './components/ChatBubble.jsx'

// Lazy-load non-dashboard routes to keep initial bundle small and fast
const TeacherForm = lazy(() => import('./components/TeacherForm.jsx'))
const RoomForm = lazy(() => import('./components/RoomForm.jsx'))
const ClassForm = lazy(() => import('./components/ClassForm.jsx'))
const SubjectForm = lazy(() => import('./components/SubjectForm.jsx'))
const TimeSlotForm = lazy(() => import('./components/TimeSlotForm.jsx'))
const TeacherSubjectForm = lazy(() => import('./components/TeacherSubjectForm.jsx'))
const TeacherAvailabilityForm = lazy(() => import('./components/TeacherAvailabilityForm.jsx'))
const GenerateTimetable = lazy(() => import('./components/GenerateTimetable.jsx'))
const TimetableGrid = lazy(() => import('./components/TimetableGrid.jsx'))
const ConstraintsPage = lazy(() => import('./pages/ConstraintsPage.jsx'))
const AcademicStructure = lazy(() => import('./components/AcademicStructureV2.jsx'))
const AcademicLegacyCleanup = lazy(() => import('./components/AcademicLegacyCleanup.jsx'))
const AcademicSubjects = lazy(() => import('./components/AcademicSubjects.jsx'))
const FacultyAssignments = lazy(() => import('./components/FacultyAssignments.jsx'))

function AcademicStructurePage() {
  return (
    <>
      <AcademicStructure />
      <AcademicLegacyCleanup />
    </>
  )
}

function RouteLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: '600',
      color: 'var(--text-muted, #64748b)',
    }}>
      Loading...
    </div>
  )
}

export default function App() {
  const [enteredApp, setEnteredApp] = useState(false)

  return (
    <BrowserRouter>
      {!enteredApp && <LandingScreen onEnter={() => setEnteredApp(true)} />}
      <div style={{ display:'flex', height:'100vh', width:'100%', overflow:'hidden', background:'var(--bg-page)', fontFamily:"'Inter','Segoe UI',sans-serif", opacity:enteredApp?1:0, transition:'opacity .4s ease' }}>
        <Navbar />
        <div style={{ flex:1, height:'100vh', overflowY:'auto', overflowX:'hidden', background:'var(--bg-page)' }}>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<StatusDashboard />} />
              <Route path="/academic-structure" element={<AcademicStructurePage />} />
              <Route path="/subjects" element={<AcademicSubjects />} />
              <Route path="/faculty-assignments" element={<FacultyAssignments />} />
              <Route path="/teachers" element={<TeacherForm />} />
              <Route path="/rooms" element={<RoomForm />} />
              <Route path="/classes" element={<ClassForm />} />
              <Route path="/legacy-subjects" element={<SubjectForm />} />
              <Route path="/timeslots" element={<TimeSlotForm />} />
              <Route path="/teacher-subjects" element={<TeacherSubjectForm />} />
              <Route path="/teacher-availability" element={<TeacherAvailabilityForm />} />
              <Route path="/constraints" element={<ConstraintsPage />} />
              <Route path="/generate" element={<GenerateTimetable />} />
              <Route path="/timetable" element={<TimetableGrid />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      <ChatBubble />
    </BrowserRouter>
  )
}
