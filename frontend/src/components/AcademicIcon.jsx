export default function AcademicIcon({ name, size = 18, stroke = 1.9 }) {
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
    const paths = {
        building: <><path d="M3 21h18" /><path d="M5 21V6l7-3 7 3v15" /><path d="M8 9h1M12 9h1M16 9h1M8 12h1M12 12h1M16 12h1M8 15h1M12 15h1M16 15h1" /></>,
        layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
        grid: <><rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" /></>,
        plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
        edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 7.5 3 3" /></>,
        trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
        close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
        check: <path d="m5 12 4 4L19 6" />,
        archive: <><path d="M4 7h16" /><path d="M6 7v13h12V7" /><path d="M9 11h6" /><path d="m9 4 6 0 1 3H8l1-3Z" /></>,
        search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
        lock: <><rect x="5" y="10" width="14" height="10" rx="2.2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
        info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.5v.01" /></>,
        book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M9 7h7M9 11h7" /></>,
        beaker: <><path d="M9 2v6.2L4.5 17a2 2 0 0 0 1.8 2.9h11.4a2 2 0 0 0 1.8-2.9L15 8.2V2" /><path d="M8 2h8" /><path d="M7 15h10" /></>,
        chevronRight: <path d="m9 6 6 6-6 6" />,
        arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
        'arrow-left': <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
        calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7 3v4M17 3v4M3.5 10h17" /><path d="M8 14h3M13 14h3M8 17h3" /></>,
    }
    return <svg {...common}>{paths[name]}</svg>
}
