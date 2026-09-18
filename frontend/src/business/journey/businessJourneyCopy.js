// Shared between the real Business recipient page (InvitationRecipientPage.jsx) and the
// Business Studio arrival scene, so the wording the owner sees while building a campaign
// is exactly what the guest sees — never independently retranslated in two places.
// title/subtitle pairs below drive the puzzle-phase header inside the shared PuzzlePlayer
// (see ReceivePage.jsx's `headerCopy` prop) — they are chosen purely from solve progress,
// never from product/engine terminology, per the locked recipient-journey spec.
export const businessJourneyCopy = {
  en: {
    arrivalTitle: 'A special invitation is waiting for you.',
    arrivalSubtitle: 'Solve the puzzle to reveal it.',
    readyTitle: 'A special invitation is waiting for you.',
    readySubtitle: 'Drag the pieces into place.',
    progressTitle: 'Keep going.',
    progressSubtitle: '{{placed}} of {{total}} in place',
    lastPieceTitle: 'One piece left.',
    lastPieceSubtitle: 'Release to lock it in'
  },
  ar: {
    arrivalTitle: 'دعوة خاصة بانتظارك.',
    arrivalSubtitle: 'حلّ الأحجية لتكشفها.',
    readyTitle: 'دعوة خاصة بانتظارك.',
    readySubtitle: 'اسحب القطع إلى مكانها.',
    progressTitle: 'واصل الحل.',
    progressSubtitle: '{{placed}} من {{total}} في مكانها',
    lastPieceTitle: 'قطعة واحدة تبقّت.',
    lastPieceSubtitle: 'أفلتها لتثبيتها'
  }
};
