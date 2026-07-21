// English locale resource
const en = {
  common: {
    back: 'Back',
    continue: 'Continue',
    cancel: 'Cancel',
    retry: 'Retry',
    goHome: 'Go Home',
    save: 'Save',
    share: 'Share',
    saved: 'Saved',
    ok: 'OK',
    loading: 'Loading...',
    recipientsCount_one: '{{count}} recipient',
    recipientsCount_other: '{{count}} recipients'
  },
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
      switchTo: 'العربية',
      ariaLabel: 'Switch language to Arabic',
    },
  },
  create: {
    title: 'Create your surprise',
    progress: {
      step1: 'Photo',
      step2: 'Message',
      step3: 'Delivery',
      step4: 'Review'
    },
    photo: {
      title: 'Upload a photo',
      subtitle: 'JPG or PNG',
      description: 'Choose the photo they’ll uncover. We’ll turn it into the puzzle that hides your message.',
      cropTitle: 'Crop Photo',
      change: 'Change',
      difficultyLabel: 'Puzzle difficulty',
      selectDifficulty: 'Select difficulty',
      pieceCount_one: '1 piece',
      pieceCount_other: '{{count}} pieces',
      recommended: 'Recommended',
      uploadError: 'Please upload a valid image file (JPG or PNG, max 15MB).',
      cropInstructions: 'Drag and zoom to frame the surprise. The final piece reveals the message underneath.',
      accessibility: {
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        rotateLeft: 'Rotate left',
        rotateRight: 'Rotate right'
      }
    },
    recipient: {
      title: 'Who is this for?',
      subtitle: 'Personalize the surprise. Choose the occasion, the tone, and write your hidden message.',
      nameLabel: 'Recipient (to)',
      namePlaceholder: 'Their name',
      recipientLabel: 'Recipient (to)',
      recipientPlaceholder: 'Their name',
      occasionLabel: "What's the occasion?",
      toneLabel: 'Choose a tone',
      messageLabel: 'Hidden Message',
      messagePlaceholder: 'Write your message here... They will only see this once the puzzle is solved.',
      characterCounter: '{{current}} / {{max}} characters',
      suggestedMessage: 'Insert suggested message',
      suggestedInsert: 'Insert suggested message',
      useCustom: 'Use custom message',
      errors: {
        nameRequired: 'Recipient name is required.',
        messageRequired: 'Message is required.'
      }
    },
    delivery: {
      title: 'Set up delivery',
      subtitle: 'Choose your package and tell us who will receive the surprise.',
      currentPlan: 'Current Package',
      currentPackage: 'Current Package',
      autoPlanSelection: 'Your package is selected automatically based on the number of recipients.',
      availablePlans: 'Available Plans',
      limitWording_one: 'Up to 1 recipient',
      limitWording_other: 'Up to {{count}} recipients',
      recipientLimit_one: 'Up to 1 recipient',
      recipientLimit_other: 'Up to {{count}} recipients',
      recipientHeader: 'Recipient (to) #{{index}}',
      recipientTitle: 'Recipient #{{index}}',
      recipientPlaceholder: 'Their name',
      removeRecipient: 'Remove',
      remove: 'Remove',
      addRecipient: 'Add another recipient',
      deliverVia: 'Deliver via',
      deliveryMethods: {
        whatsapp: 'WhatsApp',
        email: 'Email'
      },
      emailPlaceholder: 'your@email.com',
      emailInvalid: 'Enter a valid email address.',
      emailDuplicate: 'Duplicate email detected.',
      phonePlaceholder: 'Phone number',
      phoneInvalid: 'Enter a valid phone number.',
      phoneDuplicate: 'Duplicate phone number detected.',
      phoneFormatValid: 'Phone number looks good.',
      senderHeader: 'Sender details',
      senderDetailsTitle: 'Sender details',
      senderNameLabel: 'Your Name',
      senderNamePlaceholder: 'Your name',
      senderPhoneLabel: 'Your Phone Number',
      senderPhonePlaceholder: 'Your phone number',
      senderEmailLabel: 'Your Email Address',
      senderEmailPlaceholder: 'your@email.com',
      revealIdentityLabel: 'Show who this JIGZO is from',
      revealIdentityHint: 'If unticked, they will receive the surprise from a mystery sender.',
      identityDescription: 'If unticked, they will receive the surprise as a mystery sender.',
      previewTitle: 'WhatsApp Preview',
      errors: {
        senderPhoneInvalid: 'Enter a valid phone number.',
        senderEmailInvalid: 'Enter a valid email address.',
        phoneRequired: 'Phone number is required.',
        emailRequired: 'Email address is required.',
        duplicatePhone: 'Duplicate phone number detected.',
        duplicateEmail: 'Duplicate email detected.'
      }
    },
    review: {
      title: 'Review and send',
      subtitle: 'Take a last look before your surprise goes out.',
      recipientsLabel: 'Recipients (to)',
      messageLabel: 'Message',
      difficultyLabel: 'Difficulty',
      senderLabel: 'Sender shown',
      senderYes: 'Visible as {{name}}',
      senderNo: 'Anonymous',
      edit: 'Edit',
      previewTitle: 'Reveal Preview',
      tapToSolve: 'Tap to solve',
      resetSim: 'Reset preview',
      revealAlertAddon: 'Reveal Alert',
      total: 'Total',
      payAndSend: 'Pay & Send',
      launchingSoon: 'Launching Soon',
      onTheList: "You're on the list! We'll let you know the moment we launch.",
      leaveDetails: 'Leave your email and be the first to know when checkout opens.',
      emailPlaceholder: 'your@email.com',
      notifyMe: 'Notify me',
      noPayment: 'No payment required.',
      createTestReveal: 'Create Free Test Puzzle',
      summary: {
        photo: 'Photo',
        recipients: 'Recipients (to)',
        message: 'Message',
        difficulty: 'Difficulty',
        sender: 'Sender shown',
        anonymous: 'Anonymous',
        edit: 'Edit'
      },
      upgrades: {
        title: 'Add a Reveal Alert',
        tagline: 'Know the moment they finish.',
        description: 'Get a WhatsApp when they complete the puzzle, including when it happened and how long it took.',
        action: 'Add for {{price}}',
        added: 'Reveal Alert Added'
      },
      payment: {
        total: 'Total',
        checkoutDisabled: 'Checkout is currently disabled.',
        termsAgreement: 'By proceeding, you agree to our Terms of Service & Privacy Policy.',
        testModeTitle: 'Developer Test Mode Controls',
        testModeDescription: 'Staging environment allows creating free test puzzles without payment.',
        createFreeTest: 'Create Free Test Puzzle',
        submitting: 'Processing...'
      },
      success: {
        title: 'Test Reveal Created',
        linkHeader: 'Recipient Links',
        linkText: 'Recipient {{index}}',
        copyLink: 'Copy Link',
        openReveal: 'Open Reveal',
        copied: 'Copied!'
      }
    }
  },
  receive: {
    heading: 'Solve to reveal your message',
    subheading: 'Move the pieces into place.',
    piecesPlaced_one: '1 piece placed',
    piecesPlaced_other: '{{count}} / {{total}} pieces placed',
    errors: {
      loadFailed: 'Couldn’t load JIGZO',
      expired: 'Puzzle link has expired.',
      accessDenied: 'Access denied.',
      invalidRecipient: 'Invalid or missing recipient index.',
      unexpected: 'An unexpected error occurred.',
      revealLoadFailed: 'Couldn\'t load reveal image',
      imageGenerationFailed: 'Failed to generate image for saving. Please try again.'
    },
    cardAlt: 'Completed JIGZO',
    buttons: {
      saveOrShare: 'Save or Share',
      createYourOwn: 'Create Your Puzzle',
      replay: 'Replay Puzzle',
      generating: 'Generating...'
    },
    branding: {
      createdWithCare: 'Created with care.',
      madeWithJigzo: 'Made with JIGZO'
    },
    shareTitle: 'My JIGZO Surprise'
  },
  demo: {
    toName: 'Sofia',
    fromName: 'Zara',
    message: "Twelve years since this picture, and you're still one of the best parts of my life. Happy Birthday, my forever friend!",
    whatsappText: "Hi Sofia, Zara left something special for you. There's a message waiting behind a little challenge. Solve the puzzle to uncover it. 🧩 Open your JIGZO",
    captions: [
      'Upload a photo',
      'Write your message',
      'They get a WhatsApp from JIGZO',
      'They solve the puzzle',
      '',
      'Your words, revealed',
      'Yours to keep'
    ],
    loaderText: 'Preparing your reveal',
    saved: 'Saved'
  },
  whatsapp: {
    senderFallback: 'Someone',
    recipientFallback: 'receiver',
    deliveryMessage: 'Hi {{recipient}}, {{sender}} has created a surprise just for you. Solve the puzzle to reveal what\'s waiting inside. 🧩',
    cta: 'Discover Your Surprise',
    jigzoSolved: {
      preview: '🧩Hi {{sender}}, It happened!\n{{recipient}} has just discovered your surprise.\nCompleted on {{date}} • {{time}}, it took them {{duration}} to reach your words.\nOne more unforgettable moment, thanks to you. ❤️ We hope it made their day & yours.'
    }
  },
  countries: {
    BH: 'Bahrain',
    SA: 'Saudi Arabia',
    AE: 'UAE',
    KW: 'Kuwait',
    QA: 'Qatar',
    OM: 'Oman',
    JO: 'Jordan',
    EG: 'Egypt',
    GB: 'United Kingdom',
    US: 'United States',
    IN: 'India',
    PK: 'Pakistan',
    TR: 'Turkey',
    FR: 'France',
    DE: 'Germany'
  },
  difficulties: {
    extra_easy: { label: 'Extra Easy', pieces: '6 pieces', copy: 'Perfect for a quick surprise.' },
    easy: { label: 'Easy', pieces: '15 pieces', copy: 'A light challenge with a quick reveal.' },
    classic: { label: 'Classic', pieces: '18 pieces', copy: 'Just the right balance of fun and anticipation.' },
    challenging: { label: 'Challenging', pieces: '28 pieces', copy: 'For those who enjoy making the moment last.' }
  },
  packages: {
    active: 'Selected',
    single: { label: 'Single Surprise' },
    small: { label: 'Small Group' },
    friends: { label: 'Family & Friends' },
    celebration: { label: 'Celebration Pack' }
  },
  occasions: {
    love: 'Love',
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    congrats: 'Congrats',
    sorry: 'Sorry',
    missyou: 'Miss You',
    getwell: 'Get Well',
    thankyou: 'Thank You',
    newbaby: 'New Baby',
    justbecause: 'Just Because'
  },
  tones: {
    romantic: 'Romantic',
    funny: 'Funny',
    deep: 'Deep',
    short: 'Short',
    poetic: 'Poetic',
    family: 'Family',
    friendship: 'Friendship',
    playful: 'Playful'
  },
  upgrades: {
    insights: {
      name: 'Add a Reveal Alert',
      tagline: 'Know the moment they finish.',
      description: 'Get a WhatsApp when they complete the puzzle, including when it happened and how long it took.'
    }
  },
  messages: {
    love: {
      romantic: "Every love story is different. Mine simply became my favorite the day you walked into it.",
      funny: "I was going to write something incredibly romantic... then I remembered you already know I'm obsessed with you.",
      deep: "Loving you never felt like a decision. It felt like finally recognizing where I belonged.",
      short: "You still feel like my favorite hello.",
      poetic: "If my heart had a language, every sentence would somehow end with your name.",
      family: "Home stopped being a place the day it became you.",
      friendship: "Every great friendship deserves someone brave enough to admit... I think mine became love.",
      playful: "Congratulations... you're officially stuck with me.",
    },
    birthday: {
      romantic: "Another birthday, another reminder of how lucky I am that you exist.",
      funny: "You're not getting older... you're just becoming a classic.",
      deep: "I hope this year brings you moments you'll remember long after you've forgotten today's gifts.",
      short: "Today belongs to you. Enjoy every second.",
      poetic: "May this year leave beautiful fingerprints on your soul.",
      family: "Thank you for making our family brighter simply by being you.",
      friendship: "Life became more fun the day we became friends.",
      playful: "Eat the cake. Blame tomorrow.",
    },
    anniversary: {
      romantic: "Every year with you feels less like time passing and more like memories collecting.",
      funny: "We survived another year of my terrible jokes. That's real commitment.",
      deep: "Love isn't measured by years together. It's measured by choosing each other every day.",
      short: "Still my favorite person.",
      poetic: "Some promises grow more beautiful every sunrise.",
      family: "Thank you for building a life our family gets to call home.",
      friendship: "My favorite relationship began with my favorite friendship.",
      playful: "I'd still swipe right.",
    },
    congrats: {
      romantic: "Watching you succeed is one of my greatest joys.",
      funny: "Finally! Now everyone else knows how amazing you are.",
      deep: "Success is simply the world catching up with your effort.",
      short: "You earned every bit of this.",
      poetic: "Dreams bloom quietly before the world notices the flowers.",
      family: "You've made us all incredibly proud.",
      friendship: "Watching you win feels like winning a little myself.",
      playful: "Okay... now don't forget us when you're famous.",
    },
    sorry: {
      romantic: "If love means anything, it means trying to become better after hurting the one you love.",
      funny: "I'm officially applying for the position of \"Person Who Learns From Their Mistakes.\"",
      deep: "I can't rewrite yesterday, but I can choose who I become tomorrow.",
      short: "I'm truly sorry.",
      poetic: "Even broken moments deserve gentle healing.",
      family: "Family deserves patience. I'm sorry I forgot that.",
      friendship: "I'd rather repair this friendship than win any argument.",
      playful: "Peace offering accepted? (Please say yes.)",
    },
    missyou: {
      romantic: "Distance changes where we are, never where my heart stays.",
      funny: "Please come back. I'm running out of people willing to laugh at my jokes.",
      deep: "Some people leave an absence louder than any noise.",
      short: "I miss you.",
      poetic: "Even the quiet reminds me of you.",
      family: "Home feels smaller without you here.",
      friendship: "Missing a friend is just another way of appreciating them.",
      playful: "Hurry back. Life is getting boring.",
    },
    getwell: {
      romantic: "I'll be here through every good day and every difficult one.",
      funny: "Your only job right now is to rest. I'll allow it.",
      deep: "Healing takes courage, even on the quiet days.",
      short: "One day at a time.",
      poetic: "Storms eventually become stories.",
      family: "We're all waiting to see your smile again.",
      friendship: "Rest today. Adventures can wait.",
      playful: "Doctor's orders: Accept unlimited hugs.",
    },
    thankyou: {
      romantic: "Thank you for loving me in ways words will never fully explain.",
      funny: "I'd say I owe you one... but we're way past keeping score.",
      deep: "Kindness leaves marks we rarely get to see. Yours changed me.",
      short: "Thank you. Truly.",
      poetic: "Gratitude is love remembered.",
      family: "Thank you for everything you've quietly done for us.",
      friendship: "Every good friend deserves to hear they're appreciated.",
      playful: "You're officially my favorite human today.",
    },
    newbaby: {
      romantic: "Our greatest adventure has just begun.",
      funny: "Sleep is cancelled. Love has officially arrived.",
      deep: "Tiny hands. Endless possibilities.",
      short: "Welcome, little one.",
      poetic: "A new heartbeat has rewritten the rhythm of this family.",
      family: "Our family just became even more beautiful.",
      friendship: "Your little miracle is already so loved.",
      playful: "The smallest boss has officially arrived.",
    },
    justbecause: {
      romantic: "I didn't need a reason to think about you. I just did.",
      funny: "No occasion. No excuse. Just me being awesome enough to send you this.",
      deep: "The best reminders are the ones no one expected.",
      short: "You matter.",
      poetic: "Some thoughts deserve to travel farther than silence.",
      family: "Just a reminder that you're loved more than you know.",
      friendship: "Friends don't always need a reason to make each other smile.",
      playful: "Surprise! This puzzle contains 100% appreciation.",
    }
  },
  terms: {
    lastUpdated: 'Last Updated: July 2026',
    title: 'Terms & Conditions',
    intro: {
      welcome: 'Welcome to JIGZO',
      thanks: 'Thank you for using JIGZO.',
      desc: 'JIGZO is a digital platform that allows users to create personalized puzzle experiences that reveal hidden messages, photos, and memories.',
      agree: 'By accessing or using JIGZO, you agree to these Terms & Conditions. If you do not agree, please do not use the Service.'
    },
    sec1: {
      title: '1. Eligibility',
      p1: 'You must be at least 18 years old or have permission from a parent or legal guardian to use JIGZO.',
      p2: 'By placing an order, you confirm that you have the legal capacity to enter into this agreement.'
    },
    sec2: {
      title: '2. Our Service',
      p1: 'JIGZO allows users to:',
      bullets: [
        'Create personalized digital puzzles',
        'Upload photos',
        'Write custom messages',
        'Send puzzle links to recipients',
        'Receive puzzle completion insights (where available)'
      ],
      p2: 'JIGZO provides the platform only and does not create, edit, or monitor every piece of user-generated content.'
    },
    sec3: {
      title: '3. User Responsibilities',
      p1: 'You agree that all information you provide is accurate.',
      p2: 'You are responsible for:',
      bullets: [
        'Photos you upload',
        'Messages you write',
        'Recipient names',
        'Recipient phone numbers',
        'Ensuring you have permission to use uploaded content'
      ],
      p3: 'You are responsible for correcting any mistakes before placing your order.'
    },
    sec4: {
      title: '4. Acceptable Use',
      p1: 'You agree NOT to use JIGZO for:',
      bullets: [
        'Harassment',
        'Bullying',
        'Threats',
        'Hate speech',
        'Illegal activities',
        'Copyright infringement',
        'Sexual or explicit material',
        'Defamation',
        'Spam',
        'Fraud',
        'Malware or harmful links'
      ],
      p2: 'JIGZO reserves the right to refuse service, suspend accounts, or remove content that violates these rules.'
    },
    sec5: {
      title: '5. Intellectual Property',
      p1: 'You retain ownership of the content you upload.',
      p2: 'By uploading content, you grant JIGZO a temporary license solely to:',
      bullets: [
        'Store',
        'Process',
        'Display',
        'Deliver'
      ],
      p3: 'your content for the purpose of providing the Service.',
      p4: 'This license automatically ends when your uploaded content is permanently deleted from our systems.',
      p5: 'All JIGZO branding, logos, software, website design, animations, graphics, and source code remain the property of JIGZO.'
    },
    sec6: {
      title: '6. Temporary Storage',
      p1: 'To protect your privacy:',
      p2: 'Photos, puzzle data, and messages are stored only for the time necessary to provide the Service.',
      p3: 'Unless required by law or for fraud investigations, uploaded content is automatically deleted after the applicable retention period.',
      p4: 'Deleted content cannot be recovered.'
    },
    sec7: {
      title: '7. Delivery',
      p1: 'JIGZO attempts to deliver puzzle links promptly.',
      p2: 'Delivery depends on third-party services including:',
      bullets: [
        'Internet providers',
        'WhatsApp',
        'Mobile networks',
        'Device compatibility'
      ],
      p3: 'JIGZO cannot guarantee immediate delivery in every circumstance.'
    },
    sec8: {
      title: '8. Recipient Privacy',
      p1: 'JIGZO respects the privacy of both senders and recipients.',
      p2: 'If a recipient contacts JIGZO requesting the identity of the sender, JIGZO will not disclose that information except where legally required.'
    },
    sec9: {
      title: '9. Payments',
      p1: 'Payments are processed securely by trusted third-party payment providers.',
      p2: 'JIGZO never stores your complete payment card details.',
      p3: 'Prices displayed at checkout include any applicable charges shown before payment.'
    },
    sec10: {
      title: '10. Refund Policy',
      p1: 'Because every JIGZO is personalized, orders generally cannot be cancelled or refunded after creation has started.',
      p2: 'If a technical problem caused solely by JIGZO prevents successful delivery, we will investigate and may offer:',
      bullets: [
        'a replacement,',
        'a correction,',
        'or a refund,'
      ],
      p3: 'at our discretion.'
    },
    sec11: {
      title: '11. Service Availability',
      p1: 'We strive to provide uninterrupted service.',
      p2: 'However, maintenance, technical failures, or third-party outages may occasionally affect availability.'
    },
    sec12: {
      title: '12. Limitation of Liability',
      p1: 'JIGZO is not responsible for:',
      bullets: [
        'Emotional reactions to messages',
        'Relationship disputes',
        'Incorrect recipient details entered by the sender',
        'Device compatibility issues',
        'Network failures',
        'Delays caused by third-party services'
      ],
      p2: 'To the maximum extent permitted by applicable law, JIGZO\'s liability is limited to the amount paid for the affected order.'
    },
    sec13: {
      title: '13. Fraud Prevention',
      p1: 'JIGZO may suspend or permanently block users suspected of:',
      bullets: [
        'Fraud',
        'Payment abuse',
        'Repeated misuse',
        'Illegal activity'
      ]
    },
    sec14: {
      title: '14. Law Enforcement',
      p1: 'Where required by law, court order, or other legal process, JIGZO may disclose information to the appropriate authorities.'
    },
    sec15: {
      title: '15. Changes',
      p1: 'We may update these Terms from time to time.',
      p2: 'The latest version will always be published on our website.'
    },
    sec16: {
      title: '16. Contact',
      p1: 'Questions about these Terms may be sent to: '
    }
  },
  privacy: {
    title: 'Privacy Policy',
    intro: {
      welcome: 'Your Privacy Matters',
      p1: 'JIGZO is built around personal memories.',
      p2: 'Protecting those memories is one of our highest priorities.',
      p3: 'This Privacy Policy explains what information we collect, why we collect it, and how we protect it.'
    },
    collect: {
      title: 'Information We Collect',
      p1: 'When you create a JIGZO, we may collect:',
      sender: 'Sender information:',
      senderBullets: [
        'Name',
        'Email address',
        'Phone number'
      ],
      recipient: 'Recipient information:',
      recipientBullets: [
        'Name',
        'Phone number'
      ],
      content: 'Puzzle content:',
      contentBullets: [
        'Uploaded photos',
        'Personal messages'
      ],
      technical: 'Technical information:',
      technicalBullets: [
        'Browser type',
        'Device information',
        'IP address',
        'Country (derived from IP, if applicable)',
        'Usage analytics',
        'Puzzle interaction events (for example, when a puzzle is opened or completed)'
      ],
      payment: 'Payment information:',
      paymentDesc: 'Payments are securely processed by third-party providers. JIGZO does not store complete payment card details.'
    },
    why: {
      title: 'Why We Collect Information',
      p1: 'We use your information to:',
      bullets: [
        'Create puzzles',
        'Deliver puzzle links',
        'Process payments',
        'Provide customer support',
        'Prevent fraud',
        'Improve the platform',
        'Generate anonymous service analytics'
      ]
    },
    storage: {
      title: 'Temporary Photo Storage',
      p1: 'Uploaded photos are stored temporarily. They are automatically deleted after the applicable retention period unless a longer period is required by law. Deleted photos cannot be restored.'
    },
    records: {
      title: 'Permanent Records',
      p1: 'For legal, accounting, fraud prevention, customer support, and loyalty features, JIGZO may retain limited information such as:',
      bullets: [
        'Sender name',
        'Sender email',
        'Sender phone number',
        'Purchase history',
        'Order dates',
        'Puzzle statistics'
      ],
      p2: 'This allows features like: "You\'ve created 17 unforgettable moments." without retaining the uploaded photos or messages.'
    },
    sharing: {
      title: 'Sharing Information',
      p1: 'We do not sell your personal information. We may share information only with trusted providers that help us operate JIGZO, such as:',
      bullets: [
        'Payment providers',
        'WhatsApp delivery services',
        'Website hosting providers',
        'Analytics providers'
      ],
      p2: 'They may access only the information necessary to provide their services.'
    },
    recipientPrivacy: {
      title: 'Recipient Privacy',
      p1: 'Recipient information is used only to deliver the puzzle experience. We do not use recipient contact information for marketing without consent.'
    },
    cookies: {
      title: 'Cookies',
      p1: 'JIGZO may use cookies to:',
      bullets: [
        'Keep the website functioning',
        'Improve performance',
        'Understand visitor behavior',
        'Enhance the user experience'
      ]
    },
    security: {
      title: 'Data Security',
      p1: 'We use reasonable administrative, technical, and organizational measures to help protect your information. However, no internet transmission or electronic storage method can be guaranteed to be completely secure.'
    },
    rights: {
      title: 'Your Rights',
      p1: 'Depending on applicable laws where you live, you may have rights to:',
      bullets: [
        'Access your information',
        'Correct inaccurate information',
        'Request deletion (subject to legal obligations)',
        'Object to certain processing',
        'Withdraw consent where applicable'
      ],
      p2: 'To exercise these rights, contact us at: '
    },
    children: {
      title: 'Children\'s Privacy',
      p1: 'JIGZO is not intended for children under 13. We do not knowingly collect personal information from children under 13.'
    },
    intl: {
      title: 'International Users',
      p1: 'Your information may be processed in countries different from your own.',
      p2: 'By using JIGZO, you understand that your information may be transferred and processed where our service providers operate, subject to applicable legal safeguards.'
    },
    updates: {
      title: 'Policy Updates',
      p1: 'We may update this Privacy Policy from time to time. The latest version will always appear on our website.'
    },
    contact: {
      title: 'Contact',
      p1: 'For privacy-related questions, contact: '
    }
  },
  meta: {
    title: 'JIGZO | Turn Any Photo Into a Puzzle Surprise',
    description: 'Turn a photo and personal message into an interactive puzzle surprise, delivered instantly through WhatsApp. No app needed—create yours in minutes.',
  },
};

export default en;
