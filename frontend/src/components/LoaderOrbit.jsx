import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LoaderOrbit() {
  const { t } = useTranslation();

  return (
    <div className="jz-orbit" role="status" aria-label={t('common.loading')}>
      <div className="jz-orbit__ring">
        <div className="jz-orbit__arm">
          <div className="jz-orbit__badge">
            <svg viewBox="0 0 100 100">
              <defs>
                <linearGradient id="jzbG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#E7C485" />
                  <stop offset=".45" stopColor="#A67C3D" />
                  <stop offset="1" stopColor="#1C140A" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="49" fill="url(#jzbG)" />
              <g fill="#050505">
                <rect x="33" y="33" width="34" height="34" rx="8" />
                <circle cx="50" cy="29" r="8.6" />
                <circle cx="50" cy="71" r="8.6" />
                <circle cx="29" cy="50" r="8.6" />
                <circle cx="71" cy="50" r="8.6" />
              </g>
            </svg>
          </div>
        </div>
        <div className="jz-orbit__arm">
          <div className="jz-orbit__badge">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="49" fill="#FAF8EC" />
              <circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(5,5,5,0.07)" strokeWidth="1" />
              <g fill="#050505">
                <rect x="33" y="33" width="34" height="34" rx="8" />
                <circle cx="50" cy="29" r="8.6" />
                <circle cx="50" cy="71" r="8.6" />
                <circle cx="29" cy="50" r="8.6" />
                <circle cx="71" cy="50" r="8.6" />
              </g>
            </svg>
          </div>
        </div>
        <div className="jz-orbit__arm">
          <div className="jz-orbit__badge">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="49" fill="#111110" />
              <circle cx="50" cy="50" r="48.3" fill="none" stroke="rgba(166,124,61,0.42)" strokeWidth="1" />
              <g fill="#FAF8EC">
                <rect x="33" y="33" width="34" height="34" rx="8" />
                <circle cx="50" cy="29" r="8.6" />
                <circle cx="50" cy="71" r="8.6" />
                <circle cx="29" cy="50" r="8.6" />
                <circle cx="71" cy="50" r="8.6" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: '0' }}>
        {t('demo.loaderText')}
      </div>
    </div>
  );
}
