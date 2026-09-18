function effectivePlusOne(campaign,recipient){return recipient.plusOneOverride==='allowed'||(recipient.plusOneOverride==='inherit'&&campaign.invitation.allowPlusOneDefault);}
function responseDeadline(campaign){return campaign.invitation.rsvpDeadline||campaign.expiresAt||null;}
function assertResponseOpen(campaign,now=new Date()){
  if(campaign.invitation.rsvpEnabled===false){const error=new Error('RSVP is disabled.');error.code='RSVP_DISABLED';throw error;}
  const deadline=responseDeadline(campaign);
  if((deadline&&new Date(deadline)<=now)||(campaign.expiresAt&&new Date(campaign.expiresAt)<=now)){const error=new Error('RSVP is closed.');error.code='RSVP_CLOSED';throw error;}
}
function normalizeResponse(body,campaign,recipient){const status=body?.status;if(!['going','not_going'].includes(status))throw Object.assign(new Error('Choose Going or Not Going.'),{code:'INVALID_RESPONSE'});const guestCount=status==='not_going'?0:Number(body?.guestCount||1);if(status==='going'&&![1,2].includes(guestCount))throw Object.assign(new Error('Guest count must be 1 or 2.'),{code:'INVALID_GUEST_COUNT'});if(guestCount===2&&!effectivePlusOne(campaign,recipient))throw Object.assign(new Error('+1 is not permitted.'),{code:'PLUS_ONE_FORBIDDEN'});return{status,guestCount};}
module.exports={effectivePlusOne,responseDeadline,assertResponseOpen,normalizeResponse};
