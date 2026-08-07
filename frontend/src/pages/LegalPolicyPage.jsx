import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import legalSuite from '../content/legal-suite-en.md?raw';

const policies = {
  terms: { heading: 'TERMS OF SERVICE', path: '/terms' },
  privacy: { heading: 'PRIVACY POLICY', path: '/privacy' },
  upload: { heading: 'UPLOAD & CONTENT POLICY', path: '/upload-content' },
  refund: { heading: 'REFUND & CANCELLATION POLICY', path: '/refunds' },
  cookies: { heading: 'COOKIE & BROWSER STORAGE POLICY', path: '/cookies' },
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
  if (policy === 'upload' && heading.startsWith('1. You Are Responsible')) return 'photo-permissions';
  if (policy === 'upload' && heading.startsWith('11. Requesting Removal')) return 'requesting-removal';
  return slugify(heading);
}

function extractPolicy(heading) {
  const start = legalSuite.indexOf(`# ${heading}`);
  const nextStarts = policyOrder
    .map(({ heading: next }) => legalSuite.indexOf(`# ${next}`, start + 2))
    .filter((index) => index > start);
  const end = nextStarts.length ? Math.min(...nextStarts) : legalSuite.length;
  return legalSuite.slice(start, end).replace(/\n---\s*$/, '').trim();
}

function parseMarkdown(markdown, policy) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];

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
        id: heading[1].length > 1 ? sectionId(policy, heading[2]) : undefined,
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
  const blocks = useMemo(() => parseMarkdown(extractPolicy(config.heading), policy), [config.heading, policy]);
  const isArabic = i18n.language?.startsWith('ar');

  useEffect(() => {
    document.title = `JIGZO | ${config.heading.replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
  }, [config.heading]);

  return (
    <div className="legal-page" dir="ltr">
      <SiteHeader switcherLocation={`legal_${policy}`} />
      <main className="legal-page__container">
        {isArabic && (
          <p className="legal-page__language-note" role="note">
            The approved legal text is currently available in English. Professional Arabic legal translation is pending.
          </p>
        )}
        <nav className="legal-page__policy-nav" aria-label="Legal policies">
          {policyOrder.map((item) => (
            <Link key={item.path} to={item.path} aria-current={item.path === config.path ? 'page' : undefined}>
              {item.heading.replace(/\b\w/g, (letter) => letter.toUpperCase())}
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
