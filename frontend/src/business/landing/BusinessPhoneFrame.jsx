import React from 'react';

export default function BusinessPhoneFrame({ children, label, className = '' }) {
  return (
    <div className={`jzb-phone ${className}`} role="img" aria-label={label}>
      <div className="jzb-phone__edge">
        <div className="jzb-phone__screen">
          <span className="jzb-phone__island" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}
