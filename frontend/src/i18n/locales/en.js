// English locale (default / fallback).
// Phase 1 scope: the customer-facing LandingPage only.
// Brand names (JIGZO, WhatsApp), currency codes and live prices are NOT stored
// here — prices are interpolated at render time via {{price}}.
const en = {
  landing: {
    nav: {
      home: 'Jigzo home',
      createFull: 'Create a Surprise',
      create: 'Create',
    },
    hero: {
      eyebrow: 'A surprise worth uncovering',
      headlinePrimary: 'Don’t just send it.',
      headlineAccent: 'Let them discover it.',
      description: 'Turn any photo and message into a puzzle surprise delivered through WhatsApp.',
      cta: 'Create Your Surprise · {{price}}',
      bgAlt: 'Two women smiling at a puzzle surprise on their phone',
    },
    trust: {
      noApp: 'No app needed',
      readyInMinutes: 'Ready in minutes',
      fromPrice: 'From {{price}}',
    },
    occasions: {
      eyebrow: 'Occasions',
      title: 'Who would you surprise?',
      subtitle: 'Choose the moment. We’ll make the reveal unforgettable.',
      items: {
        birthday: { title: 'Birthday', alt: 'Birthday candle flame on cake' },
        love: { title: 'Love', alt: 'Handwritten love note and envelope' },
        friendship: { title: 'Friendship', alt: 'Two coffee cups on a table' },
        'new-baby': { title: 'New Baby', alt: 'Pair of tiny baby shoes' },
        congratulations: { title: 'Congrats', alt: 'Graduation cap and tassel' },
        'just-because': { title: 'Just Because', alt: 'Single puzzle piece casting a shadow' },
      },
    },
    steps: {
      eyebrow: 'How JIGZO works',
      headingLine1: 'Create it in minutes.',
      headingLine2: 'They’ll remember forever.',
      cta: 'Create Your Surprise',
      items: [
        { title: 'Upload your photo', body: 'It becomes their puzzle.' },
        { title: 'Add your message', body: 'Your words stay hidden until the final piece.' },
        { title: 'Send the surprise', body: 'JIGZO delivers it through WhatsApp.' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      heading: 'Start with the one that’s ready today.',
      availableNow: 'AVAILABLE NOW',
      comingSoon: 'Coming soon',
      startingFrom: 'Starting from',
      digital: {
        title: 'Digital Surprise',
        cta: 'Create Your Surprise',
        features: [
          'Upload your photo',
          'Write your hidden message',
          'Delivered via WhatsApp',
          'Works on any phone',
          'Save & share after solving',
        ],
      },
      video: {
        title: 'Video Reveal',
        desc: 'The final piece plays your video: a face, a voice, a moment that moves.',
        notify: 'Notify me',
      },
      physical: {
        title: 'Luxury Physical Puzzle',
        desc: 'Real pieces, boxed and delivered. The reveal you can hold in your hands.',
        waitlist: 'Join the waitlist',
      },
    },
    finalCta: {
      eyebrow: 'Send a surprise',
      heading: 'Make the message something they experience.',
      description: 'More memorable than a text. More personal than a greeting card. Ready in minutes.',
      cta: 'Create Your Surprise',
      startingFrom: 'Starting from {{price}}',
      deliveredWhatsApp: 'Delivered through WhatsApp',
      trust: [
        'Private and personal',
        'Works on any phone',
        'Delivered through WhatsApp',
        'Starting from {{price}}',
        'Edit before sending',
      ],
    },
    footer: {
      by: 'Product by Jigpuzzle',
      tag: 'Every surprise deserves a memorable reveal.',
      terms: 'Terms of Service',
    },
    language: {
      // Visible label = the OTHER language's native name.
      switchTo: 'العربية', // "العربية" — shown while English is active
      ariaLabel: 'Switch language to Arabic',
    },
  },
  meta: {
    title: 'JIGZO | Turn Any Photo Into a Puzzle Surprise',
    description: 'Turn a photo and personal message into an interactive puzzle surprise, delivered instantly through WhatsApp. No app needed—create yours in minutes.',
  },
};

export default en;
