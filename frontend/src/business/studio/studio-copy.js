export const studioCopy = {
  en: {
    brand: 'Business Studio', draft: 'Invitation draft', saving: 'Saving…', saved: 'All changes saved', saveError: 'Not saved', language: 'العربية', back: 'Campaigns',
    areas: ['Campaign', 'Puzzle', 'Experience', 'Recipients', 'Delivery', 'Review'],
    areaNotes: ['Name & format', 'The creative', 'Invitation details', 'Personal versions', 'How it arrives', 'Final check'],
    eyebrow: ['Set the intention', 'Build the reveal', 'Shape the moment', 'One campaign, made personal', 'Choose the arrival', 'Ready when you are'],
    aside: [
      { eyebrow: 'Step one of six', title: 'Only your team sees this name.', body: 'Guests see the event title you write in Experience, never the campaign name.' },
      { eyebrow: 'Step two of six', title: 'The image is the whole first impression.', body: 'Choose something that rewards a close look. More pieces means a longer solve, roughly a minute at six pieces and a proper solve at twenty eight.' },
      { eyebrow: 'Step three of six', title: 'Everything a guest reads lives here.', body: 'Write it once. Every guest gets the same words with their own name in place.' },
      { eyebrow: 'Step four of six', title: 'One grid, however you fill it.', body: 'Typing and CSV land in the same place. Rows save as you go, and anything unfinished stays visible until you fix it.' },
      { eyebrow: 'Step five of six', title: 'You do not pick a channel.', body: 'Each guest is reached the way you listed them. Email goes out through JIGZO right away.' },
      { eyebrow: 'Step six of six', title: 'Read it the way a guest would.', body: 'Anything in this list can be changed. Select a line to jump straight back to it.' }
    ],
    checklist: {
      title: 'Campaign status',
      campaignNamed: 'Campaign named', imageSet: 'Image and difficulty set', invitationWritten: 'Invitation written', guestsAdded: 'Guests added', deliveryClear: 'Delivery clear', readyToSend: 'Ready to send',
      invitationNote: 'Title, place, message, timing', readyNote: 'Nothing left to fix', notReadyNote: 'A few things to settle first',
      guestsAddedNote: '{{count}} {{word}} added', deliveryWaitingNote: '{{count}} {{word}} waiting on WhatsApp'
    },
    campaign: { title: 'What are you creating?', body: 'Start with the outcome. The studio will shape every other decision around it.', name: 'Campaign name', experience: 'Format', invitation: 'Invitation', active: 'Available now', reveal: 'Reveal', challenge: 'Challenge', reward: 'Reward', coming: 'Coming next', invitationBody: 'Solve the puzzle, see the invitation, reply.', notOpenTitle: 'Reveal, Challenge, Reward', notOpenBody: 'Not open yet. Invitation is the format we support today.' },
    puzzle: { title: 'Make the invitation worth unlocking.', body: 'Choose the image, then tune the solve. The actual JIGZO remains the center of the experience.', image: 'Campaign image', upload: 'Choose image', replace: 'Replace image', mocked: 'Drop the campaign image', difficulty: 'Difficulty', pieces: 'pieces', mystery: 'Mystery mode', mysteryBody: 'Pieces stay blank until the last one lands. The image is held on our side, not just hidden in the browser.', cropTitle: 'Position your photo', cropHint: 'Drag to reposition, use the slider to zoom.', cropApply: 'Use this photo', cropCancel: 'Cancel', rotateLeft: 'Rotate left', rotateRight: 'Rotate right', difficultyNotes: { extra_easy: 'About a minute', easy: 'Two minutes', classic: 'Two to three', challenging: 'A proper solve' } },
    experience: { title: 'The invitation behind the puzzle.', body: 'Structured event details make the reveal clear, useful and personal.', invitationGroup: 'Invitation', invitationHint: 'Compose the moment they uncover.', detailsGroup: 'Timing', detailsHint: 'The essentials, kept quietly in place.', policyGroup: 'Replies', policyHint: 'Set the response rules for every recipient.', eventTitle: 'Event title', date: 'Date and time', dateTimeHint: 'Shown in your browser’s own date and time format.', timezone: 'Timezone', location: 'Location', deadline: 'Replies close', message: 'Invitation message', messageHelp: 'Every guest reads the same message.', rsvp: 'Ask for a reply', rsvpBody: 'Guests answer inside the invitation.', plusOne: 'Allow a plus one', plusOneBody: 'Sets the default. You can change it per guest.' },
    recipients: { title: 'See one invitation become personal.', body: 'Select a recipient and the same campaign immediately becomes their version.', upload: 'Upload CSV', template: 'Download template', add: 'Add recipient', count: 'recipients', ready: 'ready', needAttention: 'need attention', savedAuto: 'Saved automatically', max: '2,000 max', name: 'Name', contactMethod: 'Method', contact: 'Contact', plusOne: 'Plus one', previewing: 'Previewing', emptyTitle: 'Your invitation is ready for its first name.', emptyBody: 'Add one recipient manually or upload a CSV before anyone is created.', failed: 'Recipient action could not be completed.' },
    delivery: { title: 'Choose how the puzzle arrives.', body: 'JIGZO sends every invitation. Each guest is reached the way you listed them.', readyLabel: 'invitations ready to go out', readyLabelSingular: 'invitation ready to go out', email: 'Email', emailStatus: 'Sending now', emailIdleStatus: 'Not sending yet', emailCaption: 'guests reached by email', emailCaptionSingular: 'guest reached by email', whatsapp: 'WhatsApp', whatsappCaption: 'guests waiting on WhatsApp', whatsappCaptionSingular: 'guest waiting on WhatsApp', whatsappCaptionMoved: 'moved to email', whatsappPillBlocked: 'Not available yet', whatsappPillMoved: 'Moved to email', blockedTitle: 'guests can’t be reached on WhatsApp yet', blockedBody: 'WhatsApp delivery is waiting on approval from Meta for our business template. Everything else about this campaign is ready. Fix these guests in Recipients, or leave them and send the rest.', seeWho: 'See who they are', fixInRecipients: 'Fix in Recipients', testTitle: 'Send yourself a copy', testBody: 'A real invitation with a real puzzle, addressed to you. It does not touch anyone’s results.', testPlaceholder: 'you@company.com', testButton: 'Send test',
      sendTiming: { title: 'Send timing', sendNow: 'Send now', scheduleLater: 'Schedule for later', dateLabel: 'Date', timeLabel: 'Time', timezoneLabel: 'Timezone', formatHint: 'Shown in your browser’s own date and time format.', pastError: 'Pick a time in the future.', expiryError: 'Must be before the campaign expires.', rsvpError: 'Must be before the RSVP deadline.' } },
    review: { title: 'One last read before it leaves your hands.', body: 'Everything the recipient will experience, distilled into a single campaign portrait.', campaign: 'Campaign', puzzle: 'Puzzle', event: 'Event', guests: 'Guests', delivery: 'Delivery', replies: 'Replies', edit: 'Edit', peopleWord: 'people', rowsToFix: 'row still needs a fix', rowsAllComplete: 'All rows complete', byEmail: 'by email', waiting: 'waiting', sentByJigzo: 'Sent by JIGZO', openUntil: 'Open until', notAsking: 'Not asking for replies', plusAllowed: 'Plus one allowed by default', noPlusOnes: 'No plus ones', readyHeadline: 'Everything is ready.', notReadyHeadline: 'A few things first.', readySub: 'invitations, sent the moment you press send.', notReadySub: 'Fix the rows below and this turns on.', launchNow: 'Send invitations', stillWaitingTitle: 'guests are still waiting on WhatsApp', stillWaitingBody: 'Fix them in Recipients and everyone goes out together.',
      scheduleSummary: 'Scheduled for {{date}} at {{time}} ({{timezone}})', scheduleButton: 'Schedule invitations', changeSchedule: 'Change schedule', scheduledHeadline: 'Scheduled.', scheduledSub: 'invitations, sent automatically at the scheduled time.', notScheduledHeadline: 'Not scheduled yet.', notScheduledReadySub: 'Ready to schedule once you press the button.', notScheduledSub: 'Pick a valid date and time, and add at least one ready guest, to schedule this.' },
    sending: { headline: 'Going out now.', caption: 'of {{total}} invitations handed over', captionSingular: 'of {{total}} invitation handed over', note: 'You can close this. We will keep sending.', continueLabel: 'Continue to Review' },
    home: {
      eyebrow: 'Your workspace', title: 'Your campaigns', create: 'Create campaign', search: 'Search campaigns',
      tabs: { All: 'All', Draft: 'Draft', Scheduled: 'Scheduled', Sending: 'Sending', Live: 'Live', Completed: 'Completed' },
      emptyTitle: 'Nothing here yet.', emptyBody: 'A campaign is one invitation, sent as a puzzle, made personal for every guest. It takes about four minutes to build the first one.', emptyCta: 'Create your first campaign',
      noMatches: 'No campaigns match this filter.',
      status: { draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending', active: 'Live', completed: 'Completed' },
      action: { draft: 'Resume', scheduled: 'Resume', sending: 'View progress', active: 'View results', completed: 'View results' },
      deleteDraft: 'Delete draft', deleteConfirm: 'Delete this draft campaign? This cannot be undone.',
      recipientsCount: 'recipients', recipientSingular: 'recipient', pieceSuffix: 'piece puzzle',
      updated: { editedAgo: 'Edited {{time}} ago', launchedAgo: 'Launched {{time}} ago', repliesClose: 'Replies close {{date}}', ended: 'Ended {{date}}' },
      context: { draft: '{{event}}{{sep}}{{puzzle}}', scheduled: 'Scheduled for {{date}} at {{time}}', sending: 'Sending now · {{sent}} of {{total}} delivered', active: '{{going}} going · {{waiting}} waiting to reply', completed: '{{solved}} solved · {{going}} confirmed' },
      comingTitle: 'Coming to Business', comingNote: 'Invitation is live today',
      comingReveal: 'Reveal', comingRevealBody: 'Announce something once the pieces land.',
      comingChallenge: 'Challenge', comingChallengeBody: 'A timed solve between guests.',
      comingReward: 'Reward', comingRewardBody: 'A solve that hands over an offer.',
      orgFallback: 'Your organization'
    },
    results: {
      back: 'Campaigns', live: 'Live', completed: 'Completed', sentOn: 'Sent {{date}}',
      headline: '{{count}} guests confirmed', sub: 'Replies close {{date}}. {{waiting}} people have not answered yet.', subClosed: '{{waiting}} people have not answered yet.',
      exportButton: 'Export guest list',
      stats: { invited: 'Invited', opened: 'Opened', solved: 'Solved', waiting: 'Waiting', going: 'Going', notGoing: 'Not going', plusOnes: 'Plus ones', confirmedGuests: 'Confirmed guests' },
      statsNote: { opened: '{{pct}}%', solved: 'avg {{avg}}', waiting: 'no reply yet', plusOnes: 'of {{going}} going', confirmedGuests: 'at the door' },
      tableTitle: 'Guest by guest', tableNote: 'Contacts stay masked here',
      headers: { guest: 'Guest', contact: 'Contact', opened: 'Opened', solved: 'Solved', reply: 'Reply', time: 'Solve time' },
      yes: 'Yes', notYet: 'Not yet', goingPlus: 'Going, plus one', going: 'Going', notGoing: 'Not going', waitingReply: 'Waiting'
    },
    preview: { label: 'What {{name}} receives', nextGuest: 'Next guest', madeFor: 'Made for {{name}}', solved: 'Solved', invitation: 'You’re invited', when: 'When', where: 'Where', going: 'Going', notGoing: 'Not going', guest: 'Going, plus one', personal: 'Personalized for', select: 'your guest' },
    common: { on: 'On', off: 'Off', next: 'Next area', nextTo: 'Next: {{area}}', previous: 'Previous', previousTo: 'Previous: {{area}}', complete: 'Complete', incomplete: 'In progress' }
  },
  ar: {
    brand: 'استوديو الأعمال', draft: 'مسودة دعوة', saving: 'جارٍ الحفظ…', saved: 'تم حفظ كل التغييرات', saveError: 'لم يتم الحفظ', language: 'English', back: 'الحملات',
    areas: ['الحملة', 'الأحجية', 'التجربة', 'المستلمون', 'التوصيل', 'المراجعة'],
    areaNotes: ['الاسم والنوع', 'المشهد الإبداعي', 'تفاصيل الدعوة', 'نسخ شخصية', 'طريقة الوصول', 'النظرة الأخيرة'],
    eyebrow: ['حدّد الفكرة', 'ابنِ لحظة الكشف', 'صمّم اللحظة', 'حملة واحدة، بطابع شخصي', 'اختر طريقة الوصول', 'كل شيء في مكانه'],
    aside: [
      { eyebrow: 'الخطوة الأولى من ستة', title: 'هذا الاسم يراه فريقك فقط.', body: 'يرى الضيوف عنوان المناسبة الذي تكتبه في التجربة، وليس اسم الحملة أبداً.' },
      { eyebrow: 'الخطوة الثانية من ستة', title: 'الصورة هي الانطباع الأول بأكمله.', body: 'اختر صورة تستحق نظرة فاحصة. زيادة القطع تعني وقت حل أطول، حوالي دقيقة لست قطع، وحلاً حقيقياً عند ثماني وعشرين.' },
      { eyebrow: 'الخطوة الثالثة من ستة', title: 'كل ما سيقرأه الضيف موجود هنا.', body: 'اكتبه مرة واحدة. يحصل كل ضيف على النص نفسه مع اسمه الخاص في مكانه.' },
      { eyebrow: 'الخطوة الرابعة من ستة', title: 'جدول واحد، مهما كانت طريقة تعبئته.', body: 'الكتابة اليدوية وملف CSV يصلان إلى المكان نفسه. تُحفظ الصفوف أثناء العمل، ويبقى أي صف غير مكتمل ظاهراً حتى تصلحه.' },
      { eyebrow: 'الخطوة الخامسة من ستة', title: 'أنت لا تختار قناة التوصيل.', body: 'يصل كل ضيف بالطريقة التي أدرجتها له. البريد الإلكتروني يُرسل عبر JIGZO فوراً.' },
      { eyebrow: 'الخطوة السادسة من ستة', title: 'اقرأها كما سيقرأها الضيف.', body: 'يمكن تعديل أي عنصر في هذه القائمة. اختر سطراً للانتقال إليه مباشرة.' }
    ],
    checklist: {
      title: 'حالة الحملة',
      campaignNamed: 'تسمية الحملة', imageSet: 'الصورة والصعوبة', invitationWritten: 'كتابة الدعوة', guestsAdded: 'إضافة الضيوف', deliveryClear: 'التوصيل جاهز', readyToSend: 'جاهزة للإرسال',
      invitationNote: 'العنوان، المكان، النص، التوقيت', readyNote: 'لا يوجد ما يحتاج إصلاحاً', notReadyNote: 'بعض الأمور تحتاج ضبطاً أولاً',
      guestsAddedNote: '{{count}} {{word}} تمت إضافتهم', deliveryWaitingNote: '{{count}} {{word}} بانتظار واتساب'
    },
    campaign: { title: 'ما التجربة التي تصنعها؟', body: 'ابدأ بالنتيجة التي تريدها، وسيبني الاستوديو بقية القرارات حولها.', name: 'اسم الحملة', experience: 'النوع', invitation: 'دعوة', active: 'متاحة الآن', reveal: 'كشف', challenge: 'تحدٍّ', reward: 'مكافأة', coming: 'قريباً', invitationBody: 'حلّ الأحجية، شاهد الدعوة، ثم أجب.', notOpenTitle: 'كشف، تحدٍّ، مكافأة', notOpenBody: 'غير متاحة بعد. الدعوة هي النوع المتاح حالياً.' },
    puzzle: { title: 'اجعل فتح الدعوة تجربة تستحق الحل.', body: 'اختر الصورة واضبط مستوى الأحجية. تظل تجربة JIGZO هي المشهد الأهم.', image: 'صورة الحملة', upload: 'اختر صورة', replace: 'استبدال الصورة', mocked: 'أفلت صورة الحملة هنا', difficulty: 'الصعوبة', pieces: 'قطعة', mystery: 'الوضع الغامض', mysteryBody: 'تبقى القطع فارغة حتى تستقر القطعة الأخيرة. الصورة محفوظة لدينا، وليست مخفية في المتصفح فقط.', cropTitle: 'اضبط وضع الصورة', cropHint: 'اسحب لتغيير الموضع، واستخدم الشريط للتكبير.', cropApply: 'استخدام هذه الصورة', cropCancel: 'إلغاء', rotateLeft: 'تدوير لليسار', rotateRight: 'تدوير لليمين', difficultyNotes: { extra_easy: 'حوالي دقيقة', easy: 'دقيقتان', classic: 'دقيقتان إلى ثلاث', challenging: 'حلّ حقيقي' } },
    experience: { title: 'الدعوة التي تنتظر خلف الأحجية.', body: 'تفاصيل واضحة ومنظّمة تجعل لحظة الكشف مفيدة وشخصية.', invitationGroup: 'الدعوة', invitationHint: 'صُغ اللحظة التي سيكتشفونها.', detailsGroup: 'التوقيت', detailsHint: 'المعلومات الأساسية، بهدوء ووضوح.', policyGroup: 'الردود', policyHint: 'حدّد قواعد الرد لجميع المستلمين.', eventTitle: 'عنوان المناسبة', date: 'التاريخ والوقت', dateTimeHint: 'يظهر بتنسيق التاريخ والوقت الخاص بمتصفحك.', timezone: 'المنطقة الزمنية', location: 'الموقع', deadline: 'آخر موعد للرد', message: 'نص الدعوة', messageHelp: 'يقرأ كل ضيف النص نفسه.', rsvp: 'طلب الرد', rsvpBody: 'يجيب الضيوف داخل الدعوة.', plusOne: 'السماح بمرافق', plusOneBody: 'يحدّد الإعداد الافتراضي. يمكنك تغييره لكل ضيف.' },
    recipients: { title: 'شاهد الدعوة الواحدة تصبح شخصية.', body: 'اختر مستلماً، وستتحول الحملة نفسها فوراً إلى نسخته الخاصة.', upload: 'رفع CSV', template: 'تنزيل النموذج', add: 'إضافة مستلم', count: 'مستلم', ready: 'جاهز', needAttention: 'يحتاج انتباهاً', savedAuto: 'يُحفظ تلقائياً', max: 'الحد الأقصى 2,000', name: 'الاسم', contactMethod: 'الوسيلة', contact: 'بيانات التواصل', plusOne: 'مرافق', previewing: 'قيد المعاينة', emptyTitle: 'دعوتك جاهزة لأول اسم.', emptyBody: 'أضف مستلماً يدوياً أو ارفع ملف CSV قبل إنشاء أي مستلم.', failed: 'تعذّر إكمال إجراء المستلم.' },
    delivery: { title: 'اختر كيف تصل الأحجية.', body: 'JIGZO يرسل كل دعوة. يصل كل ضيف بالطريقة التي أدرجتها له.', readyLabel: 'دعوة جاهزة للإرسال', readyLabelSingular: 'دعوة جاهزة للإرسال', email: 'البريد الإلكتروني', emailStatus: 'يُرسل الآن', emailIdleStatus: 'لم يبدأ الإرسال بعد', emailCaption: 'ضيف يصلهم عبر البريد', emailCaptionSingular: 'ضيف يصله عبر البريد', whatsapp: 'واتساب', whatsappCaption: 'ضيف بانتظار واتساب', whatsappCaptionSingular: 'ضيف بانتظار واتساب', whatsappCaptionMoved: 'تم النقل إلى البريد', whatsappPillBlocked: 'غير متاح بعد', whatsappPillMoved: 'تم النقل إلى البريد', blockedTitle: 'ضيف لا يمكن الوصول إليهم عبر واتساب بعد', blockedBody: 'التوصيل عبر واتساب بانتظار اعتماد Meta لقالب أعمالنا. كل شيء آخر في هذه الحملة جاهز. أصلح بيانات هؤلاء الضيوف في المستلمين، أو اتركهم وأرسل البقية.', seeWho: 'من هم', fixInRecipients: 'إصلاح في المستلمين', testTitle: 'أرسل نسخة لنفسك', testBody: 'دعوة حقيقية بأحجية حقيقية، موجهة إليك. لا تؤثر على نتائج أحد.', testPlaceholder: 'you@company.com', testButton: 'إرسال اختبار',
      sendTiming: { title: 'موعد الإرسال', sendNow: 'الإرسال الآن', scheduleLater: 'جدولة لاحقاً', dateLabel: 'التاريخ', timeLabel: 'الوقت', timezoneLabel: 'المنطقة الزمنية', formatHint: 'يظهر بتنسيق التاريخ والوقت الخاص بمتصفحك.', pastError: 'اختر وقتاً في المستقبل.', expiryError: 'يجب أن يكون قبل انتهاء الحملة.', rsvpError: 'يجب أن يكون قبل آخر موعد للرد.' } },
    review: { title: 'نظرة أخيرة قبل أن تغادر يديك.', body: 'كل ما سيختبره المستلم، مختصر في صورة واحدة واضحة للحملة.', campaign: 'الحملة', puzzle: 'الأحجية', event: 'المناسبة', guests: 'الضيوف', delivery: 'التوصيل', replies: 'الردود', edit: 'تعديل', peopleWord: 'شخص', rowsToFix: 'صف يحتاج إصلاحاً', rowsAllComplete: 'كل الصفوف مكتملة', byEmail: 'عبر البريد', waiting: 'بالانتظار', sentByJigzo: 'يُرسل عبر JIGZO', openUntil: 'مفتوح حتى', notAsking: 'لا يُطلب رد', plusAllowed: 'المرافق مسموح افتراضياً', noPlusOnes: 'لا مرافقين', readyHeadline: 'كل شيء جاهز.', notReadyHeadline: 'بعض الأمور أولاً.', readySub: 'دعوة، تُرسل فور الضغط على إرسال.', notReadySub: 'أصلح الصفوف أدناه ليصبح هذا متاحاً.', launchNow: 'إرسال الدعوات', stillWaitingTitle: 'ضيف ما زالوا بانتظار واتساب', stillWaitingBody: 'أصلحهم في المستلمين ليخرج الجميع معاً.',
      scheduleSummary: 'مجدولة في {{date}} الساعة {{time}} ({{timezone}})', scheduleButton: 'جدولة الدعوات', changeSchedule: 'تغيير الموعد', scheduledHeadline: 'تمت الجدولة.', scheduledSub: 'دعوة، سترسل تلقائياً في الموعد المحدد.', notScheduledHeadline: 'لم تتم الجدولة بعد.', notScheduledReadySub: 'جاهزة للجدولة بمجرد الضغط على الزر.', notScheduledSub: 'اختر تاريخاً ووقتاً صحيحين، وأضف ضيفاً جاهزاً واحداً على الأقل، لجدولة هذه الحملة.' },
    sending: { headline: 'جارٍ الإرسال الآن.', caption: 'من أصل {{total}} دعوة تم تسليمها', captionSingular: 'من أصل {{total}} دعوة تم تسليمها', note: 'يمكنك إغلاق هذه الصفحة. سنواصل الإرسال.', continueLabel: 'متابعة إلى المراجعة' },
    home: {
      eyebrow: 'مساحة عملك', title: 'حملاتك', create: 'إنشاء حملة', search: 'ابحث في الحملات',
      tabs: { All: 'الكل', Draft: 'مسودة', Scheduled: 'مجدولة', Sending: 'قيد الإرسال', Live: 'مباشرة', Completed: 'مكتملة' },
      emptyTitle: 'لا يوجد شيء هنا بعد.', emptyBody: 'الحملة هي دعوة واحدة، تُرسل كأحجية، وتُصنع خصيصاً لكل ضيف. يستغرق بناء الأولى نحو أربع دقائق.', emptyCta: 'أنشئ حملتك الأولى',
      noMatches: 'لا توجد حملات مطابقة لهذا الفلتر.',
      status: { draft: 'مسودة', scheduled: 'مجدولة', sending: 'قيد الإرسال', active: 'مباشرة', completed: 'مكتملة' },
      action: { draft: 'استئناف', scheduled: 'استئناف', sending: 'عرض التقدم', active: 'عرض النتائج', completed: 'عرض النتائج' },
      deleteDraft: 'حذف المسودة', deleteConfirm: 'حذف هذه المسودة؟ لا يمكن التراجع عن هذا الإجراء.',
      recipientsCount: 'مستلم', recipientSingular: 'مستلم', pieceSuffix: 'أحجية قطعة',
      updated: { editedAgo: 'تم التعديل قبل {{time}}', launchedAgo: 'تم الإطلاق قبل {{time}}', repliesClose: 'يُغلق الرد في {{date}}', ended: 'انتهت في {{date}}' },
      context: { draft: '{{event}}{{sep}}{{puzzle}}', scheduled: 'مجدولة في {{date}} الساعة {{time}}', sending: 'قيد الإرسال الآن · {{sent}} من {{total}} تم تسليمها', active: '{{going}} سيحضرون · {{waiting}} بانتظار الرد', completed: '{{solved}} حلّوا · {{going}} أكّدوا' },
      comingTitle: 'قادم إلى الأعمال', comingNote: 'الدعوة متاحة اليوم',
      comingReveal: 'كشف', comingRevealBody: 'أعلن عن شيء عند اكتمال القطع.',
      comingChallenge: 'تحدٍّ', comingChallengeBody: 'حلّ محدد بوقت بين الضيوف.',
      comingReward: 'مكافأة', comingRewardBody: 'حلّ يمنح عرضاً.',
      orgFallback: 'مؤسستك'
    },
    results: {
      back: 'الحملات', live: 'مباشرة', completed: 'مكتملة', sentOn: 'أُرسلت في {{date}}',
      headline: '{{count}} ضيف أكّدوا الحضور', sub: 'يُغلق الرد في {{date}}. {{waiting}} شخص لم يجيبوا بعد.', subClosed: '{{waiting}} شخص لم يجيبوا بعد.',
      exportButton: 'تصدير قائمة الضيوف',
      stats: { invited: 'المدعوون', opened: 'فتحوا الدعوة', solved: 'حلّوا الأحجية', waiting: 'بالانتظار', going: 'سيحضرون', notGoing: 'لن يحضروا', plusOnes: 'مرافقون', confirmedGuests: 'ضيوف مؤكّدون' },
      statsNote: { opened: '{{pct}}%', solved: 'بمعدل {{avg}}', waiting: 'لا رد بعد', plusOnes: 'من {{going}} سيحضرون', confirmedGuests: 'عند الباب' },
      tableTitle: 'الضيوف واحداً واحداً', tableNote: 'بيانات التواصل تبقى مخفية هنا',
      headers: { guest: 'الضيف', contact: 'التواصل', opened: 'فُتحت', solved: 'حُلّت', reply: 'الرد', time: 'وقت الحل' },
      yes: 'نعم', notYet: 'ليس بعد', goingPlus: 'سيحضر مع مرافق', going: 'سيحضر', notGoing: 'لن يحضر', waitingReply: 'بالانتظار'
    },
    preview: { label: 'ما سيصل إلى {{name}}', nextGuest: 'الضيف التالي', madeFor: 'خصيصاً لـ {{name}}', solved: 'تم الحل', invitation: 'أنت مدعو', when: 'متى', where: 'أين', going: 'سأحضر', notGoing: 'لن أحضر', guest: 'سأحضر مع مرافق', personal: 'نسخة شخصية لـ', select: 'ضيفك' },
    common: { on: 'مفعّل', off: 'متوقف', next: 'المنطقة التالية', nextTo: 'التالي: {{area}}', previous: 'السابق', previousTo: 'السابق: {{area}}', complete: 'مكتمل', incomplete: 'قيد الإعداد' }
  }
};
