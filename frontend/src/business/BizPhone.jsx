import React from 'react';

// Realistic portrait phone frame (9:19). Keeps its aspect ratio at every width
// so the mockups never compress into unreadable horizontal shapes.
export default function BizPhone({ children, className = '', label }) {
  return (
    <div className={`biz-phone ${className}`}>
      <div className="biz-phone__frame">
        <div
          className="biz-phone__screen"
          role={label ? 'img' : undefined}
          aria-label={label || undefined}
        >
          <span className="biz-phone__notch" aria-hidden="true" />
          <div className="biz-phone__inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
