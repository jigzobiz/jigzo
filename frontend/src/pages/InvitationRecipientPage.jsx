import React,{useCallback,useEffect,useRef,useState}from'react';
import PuzzlePlayer from'../components/PuzzlePlayer';
import{invitationExchange}from'../services/invitationBootstrap';
import{invitationApi}from'../services/invitationApi';
import{CONSUMER_PUZZLE_GEOMETRY}from'../puzzle/puzzle-geometry';
import{businessJourneyCopy}from'../business/journey/businessJourneyCopy';
import ArrivalScene from'../business/journey/ArrivalScene';
import SolvedInvitationFrame from'../business/journey/SolvedInvitationFrame';
import'../business/journey/business-journey.css';
import'./invitation-recipient.css';

// GET /puzzle's imageUrl field is gated purely on campaign.puzzle.mysteryMode — it
// returns null whenever mysteryMode is on, with no regard for whether this recipient
// has already solved (backend: publicInvitations.js). The actual image-serving route,
// GET /image, gates correctly on mysteryMode && !firstSolvedAt, so once a recipient has
// solved (the only time this constant is used) it always serves successfully regardless
// of mysteryMode. Using the fixed path directly — rather than a possibly-stale/null
// imageUrl fetched before solving — is what keeps Mystery Mode's actual security
// guarantee (server-side, untouched) and the Revealed frame's image in sync.
const REVEALED_IMAGE_URL='/api/public/invitations/image';

const COPY={
  en:{
    loading:'Opening your JIGZO…',
    invalid:'This invitation link is invalid or has expired.',
    solved:'Puzzle solved',
    kicker:'This is what it was hiding',
    prompt:'Will you join us?',
    going:'Going',
    goingPlus:'Going +1',
    notGoing:'Not going',
    replyingAs:name=>`Replying as ${name}. You can change your answer later.`,
    statusGoing: "You're going.",
    statusGoingPlus: "You're going with a guest.",
    statusNotGoing: "You are not attending.",
    confirmedNote:'Your response is saved.',
    change:'Change response',
    closed:'RSVP is closed.'
  },
  ar:{
    loading:'جارٍ فتح JIGZO الخاص بك…',
    invalid:'رابط الدعوة غير صالح أو انتهت صلاحيته.',
    solved:'تم حل الأحجية',
    kicker:'هذا ما كانت تخفيه',
    prompt:'هل ستنضم إلينا؟',
    going:'سأحضر',
    goingPlus:'سأحضر +1',
    notGoing:'لن أحضر',
    replyingAs:name=>`تردّ باسم ${name}. يمكنك تغيير ردك لاحقاً.`,
    statusGoing: 'أنت ذاهب.',
    statusGoingPlus: 'أنت ذاهب مع مرافق.',
    statusNotGoing: 'لن تحضر.',
    confirmedNote:'تم حفظ ردك.',
    change:'تغيير الرد',
    closed:'انتهى وقت الرد.'
  }
};

// Recipient journey (locked Claude Design recipient spec, revision 2): loading -> arrival
// (near-black envelope moment, nothing about the event on screen) -> puzzle (the existing
// shared PuzzlePlayer, unmodified, geometry=CONSUMER_PUZZLE_GEOMETRY — Business solving
// must look and play exactly like consumer Receive, per the locked product requirement;
// only the FINAL revealed card below is Business's own 4:5 shape) -> revealing (brief
// transition) -> revealed (the solved puzzle's image becomes the invitation — see
// SolvedInvitationFrame, with RSVP below it). A returning visitor who already solved skips
// straight to "revealed".
export default function InvitationRecipientPage(){
  const[phase,setPhase]=useState('loading');
  const[session,setSession]=useState(null);
  const[puzzle,setPuzzle]=useState(null);
  const[data,setData]=useState(null);
  const[invitation,setInvitation]=useState(null);
  const[response,setResponse]=useState(null);
  const[error,setError]=useState('');
  const start=useRef(Date.now());
  const lang=session?.recipient?.language||'en';
  const c=COPY[lang];
  const jc=businessJourneyCopy[lang==='ar'?'ar':'en'];
  const recipientFirstName=session?.recipient?.displayName?session.recipient.displayName.split(' ')[0]:'';

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
          setPhase('revealed');
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
        setPhase('arrival');
      }catch(e){
        if(active){
          setError(e.message);
          setPhase('error');
        }
      }
    })();
    return()=>{active=false;};
  },[]);

  const beginSolve=()=>{
    start.current=Date.now();
    setPhase('puzzle');
  };

  const headerCopy=useCallback((placedCount,total)=>{
    if(placedCount===0)return{title:jc.readyTitle,subtitle:jc.readySubtitle};
    if(placedCount===total-1)return{title:jc.lastPieceTitle,subtitle:jc.lastPieceSubtitle};
    return{title:jc.progressTitle,subtitle:jc.progressSubtitle.replace('{{placed}}',placedCount).replace('{{total}}',total)};
  },[jc]);

  const solved=useCallback(async seconds=>{
    const result=await invitationApi.solve(seconds);
    setInvitation(result.invitation);
    setSession(value=>({...value,recipient:{...value.recipient,solved:true}}));
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setPhase('revealed');
    } else {
      setPhase('revealing');
      await new Promise(r => setTimeout(r, 1600));
      setPhase('revealed');
    }
    return{success:true,message:'unlocked'};
  },[]);

  const respond=async(status,guestCount)=>{
    try{
      const result=await invitationApi.respond({status,guestCount},crypto.randomUUID());
      setResponse(result.response);
    }catch(e){
      setError(e.response?.data?.error||c.closed);
    }
  };

  if(phase==='loading')return <main className="jzi-state"><span className="jzi-mark">JIGZO</span><p>{c.loading}</p></main>;
  if(phase==='error')return <main className="jzi-state"><span className="jzi-mark">JIGZO</span><p>{c.invalid}</p></main>;

  if(phase==='arrival'){
    return (
      <main className="jzi-page jzi-page--arrival" dir={lang==='ar'?'rtl':'ltr'}>
        <ArrivalScene copy={jc} isArabic={lang==='ar'} onContinue={beginSolve} />
      </main>
    );
  }

  if(phase==='puzzle' || phase==='revealing') {
    return (
      <main className={`jzi-page${phase==='revealing'?' jzi-revealing':''}`} dir={lang==='ar'?'rtl':'ltr'}>
        <header><span className="jzi-mark">JIGZO</span></header>
        <div className="jzi-puzzle-wrapper">
          <PuzzlePlayer data={data} setData={setData} publicId="business-invitation" rIndex={0} startTimeRef={start} onSolved={solved} geometry={CONSUMER_PUZZLE_GEOMETRY} headerCopy={headerCopy}/>
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
      <header><span className="jzi-mark">JIGZO</span></header>
      <div className="jzi-solved-wrapper">
        <SolvedInvitationFrame
          mode="interactive"
          imageUrl={REVEALED_IMAGE_URL}
          kicker={c.kicker}
          recipientName={recipientFirstName}
          eventTitle={invitation.eventTitle}
          whenDisplay={`${formattedDateTime} (${invitation.timezone})`}
          location={invitation.location}
          message={invitation.message}
          rsvpEnabled={invitation.rsvpEnabled}
          allowPlusOne={invitation.allowPlusOne}
          copy={{
            prompt:c.prompt,
            going:c.going,
            goingPlus:c.goingPlus,
            notGoing:c.notGoing,
            replyingAs:response?'':c.replyingAs(session.recipient.displayName),
            statusGoing:c.statusGoing,
            statusGoingPlus:c.statusGoingPlus,
            statusNotGoing:c.statusNotGoing,
            confirmedNote:c.confirmedNote,
            change:c.change
          }}
          isArabic={lang==='ar'}
          rsvp={{
            response,
            onRespond: respond,
            onChangeResponse: () => setResponse(null)
          }}
        />
        {error && <p className="jzi-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
