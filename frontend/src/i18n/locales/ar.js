// Arabic locale (GCC / Bahrain-friendly Modern Standard Arabic).
// Tone: warm, premium, emotionally faithful to the English copy — not literal
// machine translation. Brand names (JIGZO, WhatsApp) and currency/price values
// are kept in their recognised Latin forms; {{price}} is interpolated at render.
const ar = {
  landing: {
    nav: {
      home: 'الصفحة الرئيسية لـ JIGZO',
      createFull: 'اصنع مفاجأتك',
      create: 'اصنع',
    },
    hero: {
      eyebrow: 'مفاجأةٌ تستحقّ أن تُكتشَف',
      headlinePrimary: 'لا ترسلها فحسب.',
      headlineAccent: 'دعهم يكتشفونها.',
      description: 'حوّل أي صورة ورسالة إلى مفاجأة على هيئة أحجية تصل عبر WhatsApp.',
      cta: 'اصنع مفاجأتك · {{price}}',
      bgAlt: 'امرأتان تبتسمان لمفاجأة أحجية على هاتفهما',
    },
    trust: {
      noApp: 'من دون أي تطبيق',
      readyInMinutes: 'جاهزة في دقائق',
      fromPrice: 'ابتداءً من {{price}}',
    },
    occasions: {
      eyebrow: 'المناسبات',
      title: 'مَن ستفاجئ؟',
      subtitle: 'اختر اللحظة، ونحن نجعل الكشف لا يُنسى.',
      items: {
        birthday: { title: 'عيد ميلاد', alt: 'شمعة عيد ميلاد مشتعلة على كعكة' },
        love: { title: 'حبّ', alt: 'رسالة حبّ مكتوبة بخط اليد ومغلّف' },
        friendship: { title: 'صداقة', alt: 'فنجانا قهوة على طاولة' },
        'new-baby': { title: 'مولود جديد', alt: 'حذاء صغير لطفل رضيع' },
        congratulations: { title: 'تهنئة', alt: 'قبعة تخرّج وشرابتها' },
        'just-because': { title: 'بلا مناسبة', alt: 'قطعة أحجية واحدة تُلقي بظلّها' },
      },
    },
    steps: {
      eyebrow: 'كيف تعمل JIGZO',
      headingLine1: 'اصنعها في دقائق.',
      headingLine2: 'وسيتذكّرونها إلى الأبد.',
      cta: 'اصنع مفاجأتك',
      items: [
        { title: 'ارفع صورتك', body: 'لتتحوّل إلى أحجيتهم.' },
        { title: 'أضف رسالتك', body: 'تبقى كلماتك مخفيّة حتى القطعة الأخيرة.' },
        { title: 'أرسل المفاجأة', body: 'تُسلّمها JIGZO عبر WhatsApp.' },
      ],
    },
    pricing: {
      eyebrow: 'الأسعار',
      heading: 'ابدأ بالخيار الجاهز اليوم.',
      availableNow: 'متاح الآن',
      comingSoon: 'قريباً',
      startingFrom: 'ابتداءً من',
      digital: {
        title: 'المفاجأة الرقمية',
        cta: 'اصنع مفاجأتك',
        features: [
          'ارفع صورتك',
          'اكتب رسالتك المخفيّة',
          'تصل عبر WhatsApp',
          'تعمل على أي هاتف',
          'احفظها وشاركها بعد الحلّ',
        ],
      },
      video: {
        title: 'الكشف بالفيديو',
        desc: 'القطعة الأخيرة تُشغّل الفيديو الخاص بك: وجهٌ، صوتٌ، لحظةٌ تُحرّك المشاعر.',
        notify: 'أبلِغني',
      },
      physical: {
        title: 'أحجية فاخرة ملموسة',
        desc: 'قطعٌ حقيقية، مغلّفة وتصل إلى بابك. كشفٌ تمسكه بين يديك.',
        waitlist: 'انضمّ لقائمة الانتظار',
      },
    },
    finalCta: {
      eyebrow: 'أرسل مفاجأة',
      heading: 'اجعل الرسالة تجربةً يعيشونها.',
      description: 'أكثر تميّزاً من رسالة نصية، وأكثر خصوصية من بطاقة تهنئة. جاهزة في دقائق.',
      cta: 'اصنع مفاجأتك',
      startingFrom: 'ابتداءً من {{price}}',
      deliveredWhatsApp: 'تصل عبر WhatsApp',
      trust: [
        'خاصّة وشخصية',
        'تعمل على أي هاتف',
        'تصل عبر WhatsApp',
        'ابتداءً من {{price}}',
        'عدّلها قبل الإرسال',
      ],
    },
    footer: {
      by: 'منتَج من Jigpuzzle',
      tag: 'كلّ مفاجأة تستحقّ كشفاً لا يُنسى.',
      terms: 'شروط الخدمة',
    },
    language: {
      // Visible label = the OTHER language's native name.
      switchTo: 'English', // shown while Arabic is active
      ariaLabel: 'تغيير اللغة إلى الإنجليزية',
    },
  },
  meta: {
    title: 'JIGZO | حوّل أي صورة إلى مفاجأة على هيئة أحجية',
    description: 'حوّل صورة ورسالة شخصية إلى مفاجأة تفاعلية على هيئة أحجية، تصل فوراً عبر WhatsApp. من دون أي تطبيق — اصنع مفاجأتك في دقائق.',
  },
};

export default ar;
