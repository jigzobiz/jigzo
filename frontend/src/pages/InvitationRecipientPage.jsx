import React,{useCallback,useEffect,useRef,useState}from'react';
import PuzzlePlayer from'../components/PuzzlePlayer';
import{invitationExchange}from'../services/invitationBootstrap';
import{invitationApi}from'../services/invitationApi';
import{BUSINESS_PUZZLE_GEOMETRY}from'../puzzle/puzzle-geometry';
import'./invitation-recipient.css';

const COPY={
  en:{
    loading:'Opening your JIGZO…',
    invalid:'This invitation link is invalid or has expired.',
    for:'Made personally for',
    solved:'Puzzle solved',
    invited:"You’re invited",
    going:'Going',
    plus:'Going +1',
    no:'Not going',
    confirmed:'Your response is saved.',
    change:'Change response',
    closed:'RSVP is closed.',
    statusGoing: "You're going.",
    statusGoingPlus: "You're going with a guest.",
    statusNotGoing: "You are not attending.",
    guestQuestion: "Are you bringing a guest?",
    justMe: "Just me",
    back: "Back"
  },
  ar:{
    loading:'جارٍ فتح JIGZO الخاص بك…',
    invalid:'رابط الدعوة غير صالح أو انتهت صلاحيته.',
    for:'صُممت خصيصاً لـ',
    solved:'تم حل الأحجية',
    invited:'أنت مدعو',
    going:'سأحضر',
    plus:'سأحضر +1',
    no:'لن أحضر',
    confirmed:'تم حفظ ردك.',
    change:'تغيير الرد',
    closed:'انتهى وقت الرد.',
    statusGoing: 'أنت ذاهب.',
    statusGoingPlus: 'أنت ذاهب مع مرافق.',
    statusNotGoing: 'لن تحضر.',
    guestQuestion: "هل ستحضر معك مرافقاً؟",
    justMe: "أنا فقط",
    back: "رجوع"
  }
};

export default function InvitationRecipientPage(){
  const[phase,setPhase]=useState('loading');
  const[session,setSession]=useState(null);
  const[puzzle,setPuzzle]=useState(null);
  const[data,setData]=useState(null);
  const[invitation,setInvitation]=useState(null);
  const[response,setResponse]=useState(null);
  const[error,setError]=useState('');
  const[pendingGoing,setPendingGoing]=useState(false);
  const start=useRef(Date.now());
  const lang=session?.recipient?.language||'en';
  const c=COPY[lang];

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        await invitationExchange;
        const s=await invitationApi.session();
        if(!active)return;
        setSession(s);
        document.documentElement.lang=s.recipient.language;
        document.documentElement.dir=s.recipient.language==='ar'?'rtl':'ltr';
        if(s.recipient.solved){
          setInvitation(s.invitation);
          setResponse(s.recipient.rsvpStatus==='pending'?null:{status:s.recipient.rsvpStatus,guestCount:s.recipient.guestCount});
          setPhase('invitation');
          return;
        }
        const p=await invitationApi.puzzle();
        await invitationApi.open();
        if(!active)return;
        setPuzzle(p.puzzle);
        setData({
          pieceCount:p.puzzle.pieceCount,
          cropImageUrl:p.puzzle.imageUrl,
          recipient:{name:s.recipient.displayName},
          message:'',
          experienceLanguage:s.recipient.language
        });
        start.current=Date.now();
        setPhase('puzzle');
      }catch(e){
        if(active){
          setError(e.message);
          setPhase('error');
        }
      }
    })();
    return()=>{active=false;};
  },[]);

  const solved=useCallback(async seconds=>{
    const result=await invitationApi.solve(seconds);
    setInvitation(result.invitation);
    setSession(value=>({...value,recipient:{...value.recipient,solved:true}}));
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setPhase('invitation');
    } else {
      setPhase('revealing');
      await new Promise(r => setTimeout(r, 1600));
      setPhase('invitation');
    }
    return{success:true,message:'unlocked'};
  },[]);

  const respond=async(status,guestCount)=>{
    try{
      const result=await invitationApi.respond({status,guestCount},crypto.randomUUID());
      setResponse(result.response);
      setPendingGoing(false);
    }catch(e){
      setError(e.response?.data?.error||c.closed);
    }
  };

  if(phase==='loading')return <main className="jzi-state"><span className="jzi-mark">JIGZO</span><p>{c.loading}</p></main>;
  if(phase==='error')return <main className="jzi-state"><span className="jzi-mark">JIGZO</span><p>{c.invalid}</p></main>;

  if(phase==='puzzle' || phase==='revealing') {
    return (
      <main className={`jzi-page${phase==='revealing'?' jzi-revealing':''}`} dir={lang==='ar'?'rtl':'ltr'}>
        <header>
          <span className="jzi-mark">JIGZO</span>
          <small>{c.for} {session.recipient.displayName}</small>
        </header>
        <div className="jzi-puzzle-wrapper">
          <PuzzlePlayer data={data} setData={setData} publicId="business-invitation" rIndex={0} startTimeRef={start} onSolved={solved} geometry={BUSINESS_PUZZLE_GEOMETRY}/>
        </div>
      </main>
    );
  }

  const formattedDateTime = new Date(invitation.eventDateTime).toLocaleString(lang==='ar'?'ar-BH':'en-GB',{
    dateStyle:'long',
    timeStyle:'short',
    timeZone:invitation.timezone
  });

  return (
    <main className="jzi-page jzi-reveal" dir={lang==='ar'?'rtl':'ltr'}>
      <header>
        <span className="jzi-mark">JIGZO</span>
        <small>{c.solved}</small>
      </header>
      <div className="jzi-invitation-container">
        <article className="jzi-invitation">
          <header className="jzi-greeting">
            <span className="jzi-eyebrow">{c.for}</span>
            <h2 className="jzi-recipient-name">{session.recipient.displayName}</h2>
          </header>

          <div className="jzi-badge-mark" aria-hidden="true" />

          <p className="jzi-kicker">{c.invited}</p>
          <h1 className="jzi-title">{invitation.eventTitle}</h1>

          <dl className="jzi-meta-grid">
            <div className="jzi-meta-item">
              <dt className="jzi-meta-label">When</dt>
              <dd className="jzi-meta-value">{formattedDateTime}</dd>
              <dd className="jzi-meta-tz">{invitation.timezone}</dd>
            </div>
            <div className="jzi-meta-item">
              <dt className="jzi-meta-label">Where</dt>
              <dd className="jzi-meta-value">{invitation.location}</dd>
            </div>
          </dl>

          <p className="jzi-message">{invitation.message}</p>

          {invitation.rsvpDeadline && (
            <div className="jzi-deadline">
              <span>{new Date(invitation.rsvpDeadline).toLocaleString(lang==='ar'?'ar-BH':'en-GB',{dateStyle:'medium'})}</span>
            </div>
          )}

          <div className="jzi-rsvp-section">
            {response ? (
              <div className="jzi-confirm">
                <div className="jzi-confirm__icon" aria-hidden="true">✓</div>
                <h3>
                  {response.status === 'going'
                    ? (response.guestCount > 1 ? c.statusGoingPlus : c.statusGoing)
                    : c.statusNotGoing}
                </h3>
                <p className="jzi-confirm__helper">{c.confirmed}</p>
                {invitation.rsvpEnabled && (
                  <button className="jzi-btn jzi-btn--ghost jzi-btn--small" onClick={() => setResponse(null)}>
                    {c.change}
                  </button>
                )}
              </div>
            ) : invitation.rsvpEnabled ? (
              pendingGoing && invitation.allowPlusOne ? (
                <div className="jzi-guest-selection">
                  <p className="jzi-guest-title">{c.guestQuestion}</p>
                  <div className="jzi-actions">
                    <button className="jzi-btn" onClick={() => respond('going', 1)}>{c.justMe}</button>
                    <button className="jzi-btn jzi-btn--gold" onClick={() => respond('going', 2)}>{c.plus}</button>
                    <button className="jzi-btn jzi-btn--ghost" onClick={() => setPendingGoing(false)}>{c.back}</button>
                  </div>
                </div>
              ) : (
                <div className="jzi-actions">
                  <button className="jzi-btn" onClick={() => {
                    if (invitation.allowPlusOne) {
                      setPendingGoing(true);
                    } else {
                      respond('going', 1);
                    }
                  }}>{c.going}</button>
                  <button className="jzi-btn jzi-btn--ghost" onClick={() => respond('not_going', 0)}>{c.no}</button>
                </div>
              )
            ) : null}
          </div>

          {error && <p className="jzi-error" role="alert">{error}</p>}
        </article>
      </div>
    </main>
  );
}
