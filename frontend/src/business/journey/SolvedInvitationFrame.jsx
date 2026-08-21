import React from 'react';

// The solved puzzle IS the invitation: same 3:2 sharp frame, same image, with the
// invitation content and RSVP revealed as a translucent panel inside the frame instead
// of navigating to a separate generic page/card. Used both by the real recipient page
// (mode="interactive", wired to real RSVP handlers) and the Business Studio storyboard
// preview (mode="static", decorative buttons reflecting the current draft settings).
export default function SolvedInvitationFrame({
  mode = 'interactive',
  compact = false,
  imageUrl,
  eventTitle,
  whenDisplay,
  location,
  message,
  rsvpDeadlineDisplay,
  rsvpEnabled,
  allowPlusOne,
  copy,
  isArabic,
  rsvp
}) {
  const interactive = mode === 'interactive';
  const response = interactive ? rsvp?.response : null;
  const pendingGoing = interactive ? rsvp?.pendingGoing : false;

  const renderChoices = () => {
    if (!rsvpEnabled) return null;
    if (interactive && response) {
      return <div className="jzj-solved__confirm">
        <div className="jzj-solved__confirm-icon" aria-hidden="true">✓</div>
        <strong>{response.status === 'going' ? (response.guestCount > 1 ? copy.statusGoingPlus : copy.statusGoing) : copy.statusNotGoing}</strong>
        <small>{copy.confirmed}</small>
        <button type="button" className="jzj-solved__ghost-btn" onClick={rsvp.onChangeResponse}>{copy.change}</button>
      </div>;
    }
    if (interactive && pendingGoing && allowPlusOne) {
      return <div className="jzj-solved__rsvp-row">
        <p className="jzj-solved__guest-q">{copy.guestQuestion}</p>
        <div className="jzj-solved__choices">
          <button type="button" className="jzj-solved__btn" onClick={() => rsvp.onRespond('going', 1)}>{copy.justMe}</button>
          <button type="button" className="jzj-solved__btn jzj-solved__btn--gold" onClick={() => rsvp.onRespond('going', 2)}>{copy.plus}</button>
          <button type="button" className="jzj-solved__btn jzj-solved__btn--ghost" onClick={rsvp.onBack}>{copy.back}</button>
        </div>
      </div>;
    }
    return <div className="jzj-solved__choices">
      <button type="button" className="jzj-solved__btn" onClick={interactive ? () => (allowPlusOne ? rsvp.onPendingGoing() : rsvp.onRespond('going', 1)) : undefined}>{copy.going}</button>
      {allowPlusOne && <button type="button" className="jzj-solved__btn jzj-solved__btn--gold" disabled={!interactive}>{copy.plus}</button>}
      <button type="button" className="jzj-solved__btn jzj-solved__btn--ghost" onClick={interactive ? () => rsvp.onRespond('not_going', 0) : undefined}>{copy.notGoing}</button>
    </div>;
  };

  return <div className={`jzj-solved${compact ? ' jzj-solved--compact' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
    <img className="jzj-solved__image" src={imageUrl} alt="" />
    <div className="jzj-solved__scrim" aria-hidden="true" />
    <div className="jzj-solved__panel">
      <p className="jzj-solved__kicker">{copy.invited}</p>
      <h3 className="jzj-solved__title" dir="auto">{eventTitle || '—'}</h3>
      <div className="jzj-solved__meta">
        <div><span>{copy.when}</span><b>{whenDisplay || '—'}</b></div>
        <div><span>{copy.where}</span><b dir="auto">{location || '—'}</b></div>
      </div>
      {message && <p className="jzj-solved__message" dir="auto">{message}</p>}
      {rsvpDeadlineDisplay && rsvpEnabled && <p className="jzj-solved__deadline">{rsvpDeadlineDisplay}</p>}
      {renderChoices()}
    </div>
  </div>;
}
