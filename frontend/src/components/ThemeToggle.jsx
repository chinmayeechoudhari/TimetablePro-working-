import React, { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <label className="switch" title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
      <input
        type="checkbox"
        checked={!isDark}
        onChange={(e) => setIsDark(!e.target.checked)}
      />
      <span className="slider">
        <span className="star star_1"></span>
        <span className="star star_2"></span>
        <span className="star star_3"></span>
        <svg className="cloud" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
        </svg>
      </span>
    </label>
  )
}
