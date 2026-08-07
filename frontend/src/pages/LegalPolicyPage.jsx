import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import legalSuiteEn from '../content/legal-suite-en.md?raw';
import legalSuiteAr from '../content/legal-suite-ar.md?raw';

const policies = {
  terms: { enHeading: 'TERMS OF SERVICE', arHeading: 'شروط الخدمة', path: '/terms' },
  privacy: { enHeading: 'PRIVACY POLICY', arHeading: 'سياسة الخصوصية', path: '/privacy' },
  upload: { enHeading: 'UPLOAD & CONTENT POLICY', arHeading: 'سياسة الرفع والمحتوى', path: '/upload-content' },
  refund: { enHeading: 'REFUND & CANCELLATION POLICY', arHeading: 'سياسة الاسترداد والإلغاء', path: '/refunds' },
  cookies: { enHeading: 'COOKIE & BROWSER STORAGE POLICY', arHeading: 'سياسة ملفات تعريف الارتباط وتخزين المتصفح', path: '/cookies' },
};

const policyOrder = Object.values(policies);

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sectionId(policy, heading) {
  if (policy === 'upload' && heading.startsWith('1.')) return 'photo-permissions';
  if (policy === 'upload' && heading.startsWith('11.')) return 'requesting-removal';
  return slugify(heading);
}

function extractPolicy(suite, heading, headingKey) {
  const start = suite.indexOf(`# ${heading}`);
  const nextStarts = policyOrder
    .map((item) => suite.indexOf(`# ${item[headingKey]}`, start + 2))
    .filter((index) => index > start);
  const end = nextStarts.length ? Math.min(...nextStarts) : suite.length;
  return suite.slice(start, end).replace(/\n---\s*$/, '').trim();
}

function parseMarkdown(markdown, policy, anchorReferenceMarkdown = markdown) {
  const lines = markdown.split(/\r?\n/);
  const referenceIds = anchorReferenceMarkdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{2,3}\s+(.+)$/))
    .filter(Boolean)
    .map((match) => sectionId(policy, match[1]));
  const blocks = [];
  let paragraph = [];
  let list = [];
  let sectionHeadingIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'ul', items: list });
    list = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^-\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: `h${heading[1].length}`,
        text: heading[2],
        id: heading[1].length > 1 ? referenceIds[sectionHeadingIndex++] : undefined,
      });
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (!line.trim() || line.trim() === '---') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  });
  flushParagraph();
  flushList();
  return blocks;
}

function InlineText({ children }) {
  const parts = String(children).split(/(info@jigzo\.com)/g);
  return parts.map((part, index) => part === 'info@jigzo.com'
    ? <a key={index} href="mailto:info@jigzo.com">{part}</a>
    : <React.Fragment key={index}>{part}</React.Fragment>);
}

export default function LegalPolicyPage({ policy }) {
  const { i18n } = useTranslation();
  const config = policies[policy];
  const isArabic = i18n.language?.startsWith('ar');
  const heading = isArabic ? config.arHeading : config.enHeading;
  const headingKey = isArabic ? 'arHeading' : 'enHeading';
  const suite = isArabic ? legalSuiteAr : legalSuiteEn;
  const englishPolicy = useMemo(() => extractPolicy(legalSuiteEn, config.enHeading, 'enHeading'), [config.enHeading]);
  const blocks = useMemo(
    () => parseMarkdown(extractPolicy(suite, heading, headingKey), policy, englishPolicy),
    [englishPolicy, heading, headingKey, policy, suite],
  );

  useEffect(() => {
    document.title = `JIGZO | ${heading}`;
  }, [heading]);

  return (
    <div className="legal-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <SiteHeader switcherLocation={`legal_${policy}`} />
      <main className="legal-page__container">
        <nav className="legal-page__policy-nav" aria-label={isArabic ? 'السياسات القانونية' : 'Legal policies'}>
          {policyOrder.map((item) => (
            <Link key={item.path} to={item.path} aria-current={item.path === config.path ? 'page' : undefined}>
              {isArabic ? item.arHeading : item.enHeading.replace(/\b\w/g, (letter) => letter.toUpperCase())}
            </Link>
          ))}
        </nav>
        <article className="legal-page__article">
          {blocks.map((block, index) => {
            if (block.type === 'h1') return <h1 key={index}>{block.text}</h1>;
            if (block.type === 'h2') return <h2 key={index} id={block.id}>{block.text}</h2>;
            if (block.type === 'h3') return <h3 key={index} id={block.id}>{block.text}</h3>;
            if (block.type === 'ul') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText>{item}</InlineText></li>)}</ul>;
            return <p key={index} className={index < 3 ? 'legal-page__meta' : undefined}><InlineText>{block.text}</InlineText></p>;
          })}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
