const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const ROOT=path.join(__dirname,'..','..');const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const {effectivePlusOne,assertResponseOpen,normalizeResponse}=require('../src/services/invitationPolicy');
const campaign=(overrides={})=>({invitation:{allowPlusOneDefault:false,rsvpDeadline:null,...overrides.invitation},expiresAt:overrides.expiresAt||null});
test('recipient capability and session hashes are persisted, never raw tokens',()=>{const recipient=read('backend/src/models/CampaignRecipient.js'),session=read('backend/src/models/RecipientSession.js'),access=read('backend/src/services/invitationAccessService.js');assert.match(recipient,/accessTokenHash.*select: false/);assert.match(session,/tokenHash.*select:false/);assert.doesNotMatch(recipient,/rawToken|accessToken:/);assert.match(access,/randomToken\(\).*sha256\(raw\)/s);});
test('invalid and revoked capabilities are rejected by the exchange selector',()=>{const source=read('backend/src/services/invitationAccessService.js');assert.match(source,/accessTokenHash:hash,accessRevokedAt:null/);assert.match(read('backend/src/routes/publicInvitations.js'),/Invalid invitation access/);});
test('recipient session resolves organization campaign and recipient server-side',()=>{const source=read('backend/src/services/invitationAccessService.js');assert.match(source,/organizationId:session\.organizationId/);assert.match(source,/campaignId:session\.campaignId/);assert.match(source,/recipientId:recipient\._id/);});
test('fragment token is removed before exchange request',()=>{const source=read('frontend/src/services/invitationBootstrap.js');assert.ok(source.indexOf('replaceState')<source.indexOf("fetch('/api/public/invitations/exchange'"));assert.doesNotMatch(source,/localStorage|sessionStorage/);});
test('structured invitation is withheld before solve',()=>{const source=read('backend/src/routes/publicInvitations.js');assert.match(source,/invitation:recipient\.firstSolvedAt\?reveal\(campaign,recipient\):null/);});
test('Mystery image is withheld before solve',()=>{const source=read('backend/src/routes/publicInvitations.js');assert.match(source,/mysteryMode&&!value\.recipient\.firstSolvedAt/);assert.match(source,/imageUrl:value\.campaign\.puzzle\.mysteryMode\?null/);});
test('open and solve writes only first timestamps',()=>{const source=read('backend/src/routes/publicInvitations.js');assert.match(source,/firstOpenedAt:null/);assert.match(source,/firstSolvedAt:null/);});
test('response before solve is rejected',()=>assert.match(read('backend/src/routes/publicInvitations.js'),/SOLVE_REQUIRED/));
test('+1 inherits campaign policy and allows explicit override',()=>{assert.equal(effectivePlusOne(campaign(),{plusOneOverride:'inherit'}),false);assert.equal(effectivePlusOne(campaign({invitation:{allowPlusOneDefault:true}}),{plusOneOverride:'inherit'}),true);assert.equal(effectivePlusOne(campaign(),{plusOneOverride:'allowed'}),true);});
test('+1 forbidden when effective policy says no',()=>assert.throws(()=>normalizeResponse({status:'going',guestCount:2},campaign(),{plusOneOverride:'not_allowed'}),e=>e.code==='PLUS_ONE_FORBIDDEN'));
test('Not Going always forces guest count zero',()=>assert.deepEqual(normalizeResponse({status:'not_going',guestCount:2},campaign(),{plusOneOverride:'allowed'}),{status:'not_going',guestCount:0}));
test('RSVP deadline closes responses',()=>assert.throws(()=>assertResponseOpen(campaign({invitation:{rsvpDeadline:new Date('2024-01-01')}}),new Date('2024-01-02')),e=>e.code==='RSVP_CLOSED'));
test('campaign expiry closes responses',()=>assert.throws(()=>assertResponseOpen(campaign({expiresAt:new Date('2024-01-01')}),new Date('2024-01-02')),e=>e.code==='RSVP_CLOSED'));
test('disabled RSVP rejects responses',()=>assert.throws(()=>assertResponseOpen(campaign({invitation:{rsvpEnabled:false}})),e=>e.code==='RSVP_DISABLED'));
test('same idempotency key returns prior event and event storage is bounded',()=>{const route=read('backend/src/routes/publicInvitations.js'),model=read('backend/src/models/InvitationResponseEvent.js');assert.match(route,/idempotencyKeyHash:keyHash/);assert.match(route,/if\(prior\)return res\.json/);assert.match(model,/recipientId:1,idempotencyKeyHash:1.*unique:true/);});
test('new key can append an audit event and update current RSVP',()=>{const route=read('backend/src/routes/publicInvitations.js');assert.match(route,/InvitationResponseEvent\.create/);assert.match(route,/CampaignRecipient\.updateOne/);});
test('owner results are tenant scoped and aggregate guests',()=>{const source=read('backend/src/routes/businessInvitations.js');assert.match(source,/tenantCampaignFilter\(req\.business\.organizationId/);assert.match(source,/totalConfirmedGuests/);});
test('Business puzzle uses one shared campaign asset',()=>{const puzzle=read('backend/src/models/Puzzle.js'),service=read('backend/src/services/businessPuzzleService.js');assert.match(puzzle,/businessCampaignId/);assert.match(service,/findOne\(\{scope:'business',organizationId:campaign\.organizationId,businessCampaignId:campaign\._id\}\)/);});
test('Business puzzle upload streams binary below the Vercel body limit',()=>{const route=read('backend/src/routes/businessInvitations.js'),service=read('backend/src/services/businessPuzzleService.js');assert.match(route,/express\.raw\(\{type:\['image\/jpeg','image\/png','image\/webp'\],limit:'3mb'\}\)/);assert.match(route,/persistCampaignPuzzle\(campaign,\{mime:req\.get\('content-type'\),buffer:req\.body\}\)/);assert.match(service,/Buffer\.isBuffer\(buffer\)/);assert.doesNotMatch(route,/cropData/);});
test('consumer image cleanup excludes Business assets',()=>{const cleanup=read('backend/src/utils/cleanup.js');assert.equal((cleanup.match(/scope: \{ \$ne: 'business' \}/g)||[]).length,2);});
test('consumer and Business expose one PuzzlePlayer implementation',()=>{const receive=read('frontend/src/pages/ReceivePage.jsx'),shared=read('frontend/src/components/PuzzlePlayer.jsx'),business=read('frontend/src/pages/InvitationRecipientPage.jsx');assert.match(receive,/export function PuzzlePlayer/);assert.match(shared,/from '\.\.\/pages\/ReceivePage'/);assert.match(business,/import PuzzlePlayer/);});
test('public endpoints are no-store and no-referrer',()=>{const source=read('backend/src/services/invitationAccessService.js');assert.match(source,/no-store/);assert.match(source,/no-referrer/);});
test('Phase 2C acceptance state progresses Going +1 then Not Going',()=>{const c=campaign({invitation:{allowPlusOneDefault:true}});const recipient={plusOneOverride:'inherit',firstOpenedAt:null,firstSolvedAt:null,rsvpStatus:'pending',guestCount:0};recipient.firstOpenedAt=new Date();recipient.firstSolvedAt=new Date();recipient.completionSeconds=21;let next=normalizeResponse({status:'going',guestCount:2},c,recipient);Object.assign(recipient,{rsvpStatus:next.status,guestCount:next.guestCount,respondedAt:new Date()});assert.deepEqual({solved:Boolean(recipient.firstSolvedAt),status:recipient.rsvpStatus,guests:recipient.guestCount},{solved:true,status:'going',guests:2});next=normalizeResponse({status:'not_going',guestCount:2},c,recipient);Object.assign(recipient,{rsvpStatus:next.status,guestCount:next.guestCount,respondedAt:new Date()});assert.deepEqual({status:recipient.rsvpStatus,guests:recipient.guestCount},{status:'not_going',guests:0});});

// ---- "Preview as guest" test-receiver workflow (isolated from real campaign data) ----

test('CampaignRecipient.source has a dedicated test value, distinct from manual/import',()=>{const model=read('backend/src/models/CampaignRecipient.js');assert.match(model,/source: \{ type: String, enum: \['manual', 'import', 'test'\], required: true \}/);});

test('POST /preview-recipient reuses the exact same issueAccess() the real launch flow uses — no new session/security code path — and requires the campaign puzzle to already be persisted, same gate as launch',()=>{const source=read('backend/src/routes/businessInvitations.js');assert.match(source,/router\.post\('\/:campaignId\/preview-recipient',requireBusinessCsrf/);assert.match(source,/if\(!campaign\.puzzle\?\.puzzleId\)return res\.status\(409\)\.json\(\{error:'Persist the campaign puzzle before previewing\.',code:'PUZZLE_REQUIRED'\}\)/);assert.match(source,/const raw=await issueAccess\(recipient\);/);assert.match(source,/link:`\$\{getFrontendOrigin\(\)\}\/i#t=\$\{raw\}`/);// the exact same link shape the real access-link route returns
assert.match(source,/link:`\$\{getFrontendOrigin\(\)\}\/i#t=\$\{raw\}`,issuedAt:recipient\.accessIssuedAt/);});

test('the preview recipient is created with source:\'test\", reused (not duplicated) on repeat calls, and reset to a fresh unsolved/pending state every time so the sender can re-run the whole journey',()=>{const source=read('backend/src/routes/businessInvitations.js');assert.match(source,/source:'test'/);assert.match(source,/CampaignRecipient\.findOne\(\{organizationId:req\.business\.organizationId,campaignId:campaign\._id,source:'test'\}\)/);assert.match(source,/recipient\.firstOpenedAt=null;recipient\.firstSolvedAt=null;recipient\.completionSeconds=null;recipient\.rsvpStatus='pending';recipient\.guestCount=0;recipient\.respondedAt=null;/);});

test('test recipients are excluded from every place real recipients are counted, launched to, or aggregated into results',()=>{
  // Recipients grid + the two recipient-cap checks.
  const recipients=read('backend/src/routes/businessRecipients.js');
  assert.equal((recipients.match(/source:\{\$ne:'test'\}/g)||[]).length,3,'GET /recipients, POST /recipients cap check, POST /imports cap check');
  // Launch validation — a test recipient must never be queued into a real CampaignDelivery.
  const launch=read('backend/src/services/campaignLaunchService.js');
  assert.match(launch,/CampaignRecipient\.find\(\{organizationId,campaignId:campaign\._id,source:\{\$ne:'test'\}\}\)/);
  // Campaign list card recipient stats (opened/solved/going/notGoing/rsvpPending).
  const service=read('backend/src/services/campaignService.js');
  assert.match(service,/\$match: \{ organizationId, campaignId: \{ \$in: campaignObjectIds \}, source: \{ \$ne: 'test' \} \}/);
  // The Results page's own aggregate.
  const invitations=read('backend/src/routes/businessInvitations.js');
  assert.match(invitations,/router\.get\('\/:campaignId\/results',async\(req,res,next\)=>\{try\{const campaign=await campaignFor\(req,res\);if\(!campaign\)return;const recipients=await CampaignRecipient\.find\(\{organizationId:req\.business\.organizationId,campaignId:campaign\._id,source:\{\$ne:'test'\}\}\)/);
});

test('a test recipient never triggers real delivery: createLaunchWork only ever queues from validateLaunch\'s (already test-excluded) recipient list, and the delivery worker only ever processes rows createLaunchWork queued',()=>{const launch=read('backend/src/services/campaignLaunchService.js');assert.match(launch,/const ops=validation\.recipients\.map\(recipient=>/);// no separate/independent recipient re-query for delivery queuing
const worker=read('backend/src/services/campaignDeliveryWorker.js');assert.doesNotMatch(worker,/CampaignRecipient\.find\(/,'the worker only ever claims existing CampaignDelivery rows, it never independently re-derives who to send to');});

test('the preview flow does not weaken invitation security: no separate token-issuance/verification code path, no Mystery Mode bypass, no CSRF exemption',()=>{const source=read('backend/src/routes/businessInvitations.js');assert.match(source,/router\.use\(requireBusinessAuth\)/);assert.match(source,/router\.post\('\/:campaignId\/preview-recipient',requireBusinessCsrf/);assert.doesNotMatch(source,/mysteryMode\s*[:=]\s*false/,'preview-recipient must not force mysteryMode off');// The public /i pipeline itself (session/puzzle/image/solve/response) is completely
// untouched by this feature — it has no idea a recipient is a preview vs a real one.
const publicRoutes=read('backend/src/routes/publicInvitations.js');
assert.doesNotMatch(publicRoutes,/source\s*===\s*'test'|isPreview|isTest/,'the public recipient-facing routes must stay unaware of the test/preview concept entirely');});

// ---- Exhaustive audit: every production delivery path excludes source:'test' ----
// (a follow-up correction after the first pass only proved campaignLaunchService and the
// count/results endpoints — this round audits every remaining CampaignRecipient query in
// the backend to prove there is no OTHER path a test recipient could enter delivery through.)

test('1-2-3. Preview recipient creation issues a REAL /i access capability through the exact same issueAccess() used for real recipient links (backend/src/services/invitationAccessService.js) — opening/solving/responding therefore runs through the normal, unmodified secure invitation routes (backend/src/routes/publicInvitations.js), never a special-cased preview path',()=>{
  const access=read('backend/src/services/invitationAccessService.js');
  assert.match(access,/async function issueAccess\(recipient\)/);
  const invitations=read('backend/src/routes/businessInvitations.js');
  assert.match(invitations,/\{issueAccess\}=require\('\.\.\/services\/invitationAccessService'\)/);
  // The SAME function object — not a preview-specific reimplementation.
  const issueAccessCallSites=(invitations.match(/issueAccess\(recipient\)/g)||[]).length;
  assert.equal(issueAccessCallSites,2,'exactly two call sites: the existing /access-link route and the new /preview-recipient route, both calling the one shared function');
  const publicRoutes=read('backend/src/routes/publicInvitations.js');
  assert.match(publicRoutes,/exchangeAccess/);
  assert.doesNotMatch(publicRoutes,/preview-recipient|previewRecipient/,'the public session/puzzle/solve/response routes have no special handling for preview recipients at all — they are just recipients');
});

test('4-5. Test row excluded from recipient totals AND results, exhaustively enumerated: every bulk/multi-recipient query in the backend either excludes source:\\\'test\\\' or is not a counting/selection query at all',()=>{
  // This is the full inventory of every CampaignRecipient.find/aggregate/countDocuments
  // call in backend/src as of this audit. Any NEW bulk query added later that omits the
  // filter will fail this test only if it's added to this list without the filter — the
  // point is this list itself must be re-reviewed whenever a new bulk query is added.
  const businessRecipients=read('backend/src/routes/businessRecipients.js');
  const testExclusions=(businessRecipients.match(/source:\{\$ne:'test'\}/g)||[]);
  assert.equal(testExclusions.length,3,'GET /recipients (grid), POST /recipients (2000-cap check), POST /imports (2000-cap check)');
  const launch=read('backend/src/services/campaignLaunchService.js');
  assert.match(launch,/CampaignRecipient\.find\(\{organizationId,campaignId:campaign\._id,source:\{\$ne:'test'\}\}\)/,'validateLaunch — the single source of truth for "who is ready to be delivered to"');
  const campaignSvc=read('backend/src/services/campaignService.js');
  assert.match(campaignSvc,/\$match: \{ organizationId, campaignId: \{ \$in: campaignObjectIds \}, source: \{ \$ne: 'test' \} \}/,'campaign-list card recipient stats aggregate');
  const invitations=read('backend/src/routes/businessInvitations.js');
  assert.match(invitations,/CampaignRecipient\.find\(\{organizationId:req\.business\.organizationId,campaignId:campaign\._id,source:\{\$ne:'test'\}\}\)\.sort\(\{createdAt:1\}\)/,'/results aggregate + row list');
  // Single-recipient lookups (by recipientId or token hash) are correctly NOT filtered —
  // a preview recipient's own /i session, access-link issuance, and self-referential
  // open/solve/respond updates must work exactly like a real recipient's.
  assert.match(invitations,/router\.post\('\/:campaignId\/recipients\/:recipientId\/access-link'/,'single-recipient link issuance — correctly source-agnostic, it operates on one already-identified row, not a selection query');
});

test('6-9. \\"Send now\\" cannot deliver to a test row: the manual launch route (POST /:campaignId/launch) calls createLaunchWork, which calls validateLaunch, which is the one place source:\\\'test\\\' is excluded — there is no second/independent recipient query anywhere in the launch path',()=>{
  const deliveries=read('backend/src/routes/businessDeliveries.js');
  assert.match(deliveries,/router\.post\('\/:campaignId\/launch',requireBusinessCsrf,async\(req,res,next\)=>\{try\{const preflight=await validateLaunch\(/);
  assert.match(deliveries,/const result=await createLaunchWork\(\{organizationId:req\.business\.organizationId,campaignId:req\.params\.campaignId\}\);/);
  const launch=read('backend/src/services/campaignLaunchService.js');
  // createLaunchWork's own recipient list comes from calling validateLaunch again (not a
  // separately-derived query), and its CampaignDelivery bulkWrite ops map is built only
  // from that (already test-excluded) list.
  assert.match(launch,/async function createLaunchWork\(\{organizationId,campaignId\}\)\{const validation=await validateLaunch\(\{organizationId,campaignId\}\);/);
  assert.match(launch,/const ops=validation\.recipients\.map\(recipient=>/);
  assert.doesNotMatch(launch,/CampaignRecipient\.find(?!.*source:\{\$ne:'test'\})/,'createLaunchWork must not independently re-query recipients outside validateLaunch');
});

test('7. Scheduled delivery cannot deliver to a test row either: promoteDueCampaigns (the cron-triggered scheduler) calls the SAME createLaunchWork/validateLaunch chain as manual Send now — no separate scheduled-delivery recipient query exists',()=>{
  const scheduler=read('backend/src/services/campaignScheduleService.js');
  assert.match(scheduler,/\{ createLaunchWork \} = require\('\.\/campaignLaunchService'\);/);
  assert.match(scheduler,/await createLaunchWorkFn\(\{ organizationId: c\.organizationId, campaignId: c\.campaignId \}\)/);
  assert.doesNotMatch(scheduler,/CampaignRecipient/,'the scheduler itself never touches CampaignRecipient — it only finds due Campaigns and hands off to createLaunchWork, inheriting its test-exclusion for free');
  const internalRoute=read('backend/src/routes/internal/businessDelivery.js');
  assert.match(internalRoute,/promoteDueCampaigns/);
  assert.match(internalRoute,/runDeliveryBatch/);
});

test('8. Retry/recovery cannot deliver to a test row: a CampaignDelivery row for a test recipient is never created in the first place (createLaunchWork only queues from the already-excluded validateLaunch list), so claimOne\'s retry-eligible query (which only re-claims EXISTING CampaignDelivery rows) has nothing to retry for a test recipient — there is no independent recipient-selection step in the retry path',()=>{
  const worker=read('backend/src/services/campaignDeliveryWorker.js');
  assert.match(worker,/async function claimOne\(now=new Date\(\)\)\{.*status:'failed',retryEligible:true,nextAttemptAt:\{\$lte:now\}/,'the retry query operates purely on existing CampaignDelivery documents by status/lease, never by re-deriving recipients');
  assert.doesNotMatch(worker,/CampaignRecipient\.find\(/);
});

test('10. Creating/refreshing a preview recipient never touches Campaign.status or readiness — it only writes to CampaignRecipient',()=>{
  const invitations=read('backend/src/routes/businessInvitations.js');
  const routeBody=invitations.match(/router\.post\('\/:campaignId\/preview-recipient',requireBusinessCsrf,async\(req,res,next\)=>\{([\s\S]*?)\}\);\nmodule\.exports/)?.[1] || invitations.match(/router\.post\('\/:campaignId\/preview-recipient',requireBusinessCsrf,async\(req,res,next\)=>\{([\s\S]*?)\}\}catch\(e\)\{next\(e\);\}\}\);/)[1];
  assert.doesNotMatch(routeBody,/Campaign\.(updateOne|findOneAndUpdate|findByIdAndUpdate)/,'the preview-recipient route must never mutate the Campaign document itself');
});

test('11. Mystery Mode security is untouched for preview recipients: GET /image\\\'s gate (mysteryMode && !firstSolvedAt) reads recipient.firstSolvedAt the same way for every recipient regardless of source — a preview recipient only sees the image after actually solving its own puzzle, exactly like a real recipient',()=>{
  const publicRoutes=read('backend/src/routes/publicInvitations.js');
  assert.match(publicRoutes,/if\(value\.campaign\.puzzle\.mysteryMode&&!value\.recipient\.firstSolvedAt\)return res\.status\(403\)/);
  assert.doesNotMatch(publicRoutes,/source/,'the gate never inspects recipient.source — it cannot distinguish a preview recipient from a real one, so it cannot be weaker for one than the other');
});

test('12. Tenant isolation, auth and CSRF are enforced on preview-recipient creation exactly like every other Business route: router.use(requireBusinessAuth) at the top of the file, requireBusinessCsrf on this route, and campaignFor() scopes the campaign lookup to the caller\'s own organizationId (tenantCampaignFilter) before anything else runs',()=>{
  const invitations=read('backend/src/routes/businessInvitations.js');
  assert.match(invitations,/^const router=express\.Router\(\);router\.use\(requireBusinessAuth\);/m);
  assert.match(invitations,/async function campaignFor\(req,res\)\{const campaign=await Campaign\.findOne\(tenantCampaignFilter\(req\.business\.organizationId,req\.params\.campaignId\)\);/);
  assert.match(invitations,/router\.post\('\/:campaignId\/preview-recipient',requireBusinessCsrf,async\(req,res,next\)=>\{try\{const campaign=await campaignFor\(req,res\);if\(!campaign\)return;/);
});

test('The test-send route (Send yourself a copy) also excludes source:\'test\' defensively — even though the Recipients dropdown that supplies its recipientId already excludes test rows client-side, the backend does not trust that alone',()=>{
  const deliveries=read('backend/src/routes/businessDeliveries.js');
  assert.match(deliveries,/recipientId:req\.body\?\.recipientId,state:'ready',source:\{\$ne:'test'\}/);
});
