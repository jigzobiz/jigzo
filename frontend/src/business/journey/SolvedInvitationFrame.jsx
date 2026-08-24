import React from 'react';

// The solved puzzle IS the invitation — a single 4:5 portrait frame (the locked Claude
// Design recipient spec, revision 2) with the event content overlaid directly on the
// photo via a bottom scrim, and replies sitting below it, never on top of it. Used both
// by the real recipient page (mode="interactive", wired to real RSVP handlers) and the
// Business Studio preview (mode="static", decorative buttons reflecting the current
// draft settings) — same component, same composition, so the sender approves exactly
// what the guest will see. Sizing is container-query driven (see business-journey.css)
// so the identical markup reads correctly both inside Studio's narrow phone shell and
// the full-width recipient page, with no separate "compact" prop/variant needed.
export default function SolvedInvitationFrame({
  mode = 'interactive',
  imageUrl,
  kicker,
  eventTitle,
  whenDisplay,
  location,
  message,
  rsvpEnabled,
  allowPlusOne,
  copy,
  isArabic,
  rsvp
}) {
  const interactive = mode === 'interactive';
  const response = interactive ? rsvp?.response : null;

  const respond = (status, guestCount) => {
    if (interactive) rsvp.onRespond(status, guestCount);
  };

  const renderChoices = () => {
    if (!rsvpEnabled) return null;
    if (interactive && response) {
      const statusText = response.status === 'going'
        ? (response.guestCount > 1 ? copy.statusGoingPlus : copy.statusGoing)
        : copy.statusNotGoing;
      return <div className="jzj-solved__confirm">
        <div className="jzj-solved__confirm-icon" aria-hidden="true">&#10003;</div>
        <strong>{statusText}</strong>
        <small>{copy.confirmedNote}</small>
        <button type="button" className="jzj-solved__ghost-btn" onClick={rsvp.onChangeResponse}>{copy.change}</button>
      </div>;
    }
    return <>
      <div className={`jzj-solved__choices${allowPlusOne ? ' jzj-solved__choices--stack' : ''}`}>
        <button type="button" className="jzj-solved__btn jzj-solved__btn--primary" onClick={() => respond('going', 1)}>{copy.going}</button>
        {allowPlusOne && <button type="button" className="jzj-solved__btn jzj-solved__btn--secondary" onClick={() => respond('going', 2)}>{copy.goingPlus}</button>}
        <button type="button" className={`jzj-solved__btn jzj-solved__btn--${allowPlusOne ? 'ghost' : 'secondary'}`} onClick={() => respond('not_going', 0)}>{copy.notGoing}</button>
      </div>
      {copy.replyingAs && <p className="jzj-solved__replying">{copy.replyingAs}</p>}
    </>;
  };

  return <div className="jzj-solved" dir={isArabic ? 'rtl' : 'ltr'}>
    {kicker && <p className="jzj-solved__kicker" dir="auto">{kicker}</p>}
    <div className="jzj-solved__frame">
      {imageUrl && <img className="jzj-solved__image" src={imageUrl} alt="" />}
      <div className="jzj-solved__scrim" aria-hidden="true" />
      <div className="jzj-solved__overlay">
        <div className="jzj-solved__rule" aria-hidden="true" />
        <h3 className="jzj-solved__title" dir="auto">{eventTitle || '—'}</h3>
        <div className="jzj-solved__meta">
          <span dir="auto">{whenDisplay || '—'}</span>
          <span dir="auto">{location || '—'}</span>
        </div>
        {message && <p className="jzj-solved__message" dir="auto">{message}</p>}
      </div>
    </div>
    {rsvpEnabled && <div className="jzj-solved__reply">
      <p className="jzj-solved__prompt">{copy.prompt}</p>
      {renderChoices()}
    </div>}
  </div>;
}
