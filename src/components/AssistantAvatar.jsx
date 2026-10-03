import React from 'react';
import '../assistant-avatar.css';

/** Original Worklane character. Status decoration; it never announces a new message. */
export default function AssistantAvatar({ state = 'idle', size = 28 }) {
  const status = ['idle', 'thinking', 'talking'].includes(state) ? state : 'idle';
  const dimension = typeof size === 'number' && Number.isFinite(size) ? Math.max(16, Math.min(96, size)) : 28;
  return <span className={`assistant-avatar assistant-avatar--${status}`} style={{ width: dimension, height: dimension }}>
    <svg viewBox="0 0 48 48" width={dimension} height={dimension} role="img" aria-label={`Worklane assistant · ${status}`} focusable="false">
      <path className="assistant-antenna-stem" d="M24 10V6" />
      <circle className="assistant-antenna" cx="24" cy="5" r="2.5" />
      <path className="assistant-ear" d="M8 23H5v8h3m32-8h3v8h-3" />
      <rect className="assistant-head" x="8" y="11" width="32" height="30" rx="11" />
      <path className="assistant-brow" d="M15 18.5h4m10 0h4" />
      <g className="assistant-eyes">
        <rect x="15" y="22" width="4" height="7" rx="2" />
        <rect x="29" y="22" width="4" height="7" rx="2" />
      </g>
      <path className="assistant-smile" d="M20 33q4 3 8 0" />
      <g className="assistant-voice">
        <path d="M20 33v1" /><path d="M24 32v3" /><path d="M28 33v1" />
      </g>
      <circle className="assistant-cheek" cx="12.5" cy="30" r="1.5" />
      <circle className="assistant-cheek" cx="35.5" cy="30" r="1.5" />
    </svg>
  </span>;
}
