"""Generate Slogan's original 24 px outline SVG icon set."""

from pathlib import Path
import json
import sys

ICONS = {
    "add": '<path d="M12 5v14M5 12h14"/>',
    "arrow-left": '<path d="m14.5 5-7 7 7 7"/>',
    "more": '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-2.2 4.6-4.6 2.2 2.2-4.6z"/>',
    "room": '<path d="M4 20V6.5A2.5 2.5 0 0 1 6.5 4H17a2 2 0 0 1 2 2v14"/><path d="M3 20h18M9 4v16M13 12h2"/>',
    "message": '<path d="M20 11.5a8 8 0 0 1-8 8 8.8 8.8 0 0 1-3.6-.8L4 20l1.3-4.3A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h8"/>',
    "user": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    "users": '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M16.5 14a5 5 0 0 1 4 5"/>',
    "mic": '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>',
    "mic-off": '<path d="m4 4 16 16M9 9v3a3 3 0 0 0 5.2 2M15 9V6a3 3 0 0 0-5.1-2.1M5.5 11.5a6.5 6.5 0 0 0 11 4.7M18.5 11.5a6.5 6.5 0 0 1-.8 3.2M12 18v3M8.5 21h7"/>',
    "waveform": '<path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 6v12M22 10v4"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    "filter": '<path d="M4 6h16M7 12h10M10 18h4"/><circle cx="8" cy="6" r="1.5" fill="white"/><circle cx="15" cy="12" r="1.5" fill="white"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 10.5v5M12 7.5h.01"/>',
    "share": '<path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    "send-up": '<path d="M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5"/>',
    "lock": '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    "crown": '<path d="m3 8 4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5zM6 21h12"/>',
    "headphones": '<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2ZM20 13h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z"/>',
    "hand": '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7M17 10a1.5 1.5 0 0 1 3 0v5c0 3.3-2.7 6-6 6h-3.5a6 6 0 0 1-4.8-2.4L3.5 16a1.7 1.7 0 0 1 2.6-2.2L8 16"/>',
    "leave": '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 12h9m0 0-3-3m3 3-3 3"/>',
    "shield": '<path d="M12 2.5 20 6v6c0 4.6-3 7.6-8 9.5C7 19.6 4 16.6 4 12V6z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>',
    "flag": '<path d="M5 21V4m0 1c3-2 5 2 8 0s5 0 6 1v10c-2-1-4-2-7 0s-5-1-7 0"/>',
    "sparkles": '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7zM19 16l.7 1.3L21 18l-1.3.7L19 20l-.7-1.3L17 18l1.3-.7zM5 3l.5 1L6.5 4.5l-1 .5L5 6l-.5-1-1-.5 1-.5z"/>',
    "check": '<path d="m4.5 12 5 5 10-10"/>',
    "close": '<path d="M5 5l14 14M19 5 5 19"/>',
    "bell": '<path d="M18 8a6 6 0 0 0-12 0c0 6-2 6-2 8h16c0-2-2-2-2-8ZM10 20h4"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M10 2h4l.6 2.3 2 .9 2.1-1.2 2.8 2.8-1.2 2.1.9 2L23 11v2l-2.3.6-.9 2 1.2 2.1-2.8 2.8-2.1-1.2-2 .9L14 22h-4l-.6-2.3-2-.9-2.1 1.2-2.8-2.8 1.2-2.1-.9-2L1 13v-2l2.3-.6.9-2L3 6.3l2.8-2.8 2.1 1.2 2-.9z"/>',
    "file-text": '<path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 3v5h4M8 12h7M8 16h7"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    "refresh": '<path d="M20 7v5h-5M4 17v-5h5M5.5 10A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-3"/>',
    "eye": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    "play": '<path d="m8 5 11 7-11 7z"/>',
    "pause": '<path d="M8 5v14M16 5v14"/>',
    "history": '<path d="M4 7V3m0 4h4M4.3 7A9 9 0 1 1 3 12M12 7v5l3 2"/>',
    "link": '<path d="M9 15l6-6M8.5 8H7a4 4 0 0 0 0 8h2M15 8h2a4 4 0 0 1 0 8h-2"/>',
    "network-off": '<path d="M3 9a15 15 0 0 1 15.6-1.5M5.5 12.5a10 10 0 0 1 8.5-.8M9 16a5 5 0 0 1 2.5-.7M12 20h.01M3 3l18 18"/>',
    "user-remove": '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 10h5"/>',
    "ban": '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6 18.4 18.4"/>',
    "warning": '<path d="m12 3 10 17H2zM12 9v5M12 17h.01"/>',
    "error": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    "appeal": '<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM15 3v5h4M8 13h8M8 17h5"/><path d="m15 18 2 2 4-4"/>',
    "record": '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
    "stop": '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    "dashboard": '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    "role": '<circle cx="8" cy="8" r="3"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M17 8h5M19.5 5.5v5M16 15h6M16 19h4"/>',
    "audit": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8 10h7M8 14h7M8 18h4"/><path d="m15 18 1.5 1.5L20 16"/>',
    "sort": '<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>',
    "export": '<path d="M12 3v12m0-12L8 7m4-4 4 4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    "external-link": '<path d="M13 5h6v6M19 5l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    "help": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
}

ROOT = Path(__file__).resolve().parent


def svg(body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
        'viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        + body
        + '</svg>\n'
    )


for name, body in ICONS.items():
    (ROOT / f"{name}.svg").write_text(svg(body), encoding="utf-8")

if "--json" in sys.argv:
    print(json.dumps({name: svg(body) for name, body in ICONS.items()}, ensure_ascii=False))
else:
    print(f"Generated {len(ICONS)} SVG icons in {ROOT}")
