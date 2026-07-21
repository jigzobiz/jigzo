import React from 'react';
import { useTranslation } from 'react-i18next';

export default function WhatsAppPreview({ senderName, showIdentity, receiverName }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const WA_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const now = new Date();
  let hh = now.getHours();
  const ap = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  const stamp = hh + ":" + String(now.getMinutes()).padStart(2, "0") + " " + ap;

  const doodle = "url(\"data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'>" +
    "<g fill='none' stroke='#CBBBA4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.5'>" +
    "<path d='M22 34c-5-7-16-4-16 4 0 8 16 15 16 15s16-7 16-15c0-8-11-11-16-4z'/>" +
    "<circle cx='112' cy='26' r='12'/><path d='M107 29q5 5 10 0'/>" +
    "<rect x='16' y='96' width='26' height='16' rx='7'/><path d='M42 100h5a3 3 0 0 1 0 8h-5'/><path d='M22 92q2-4 0-7M30 92q2-4 0-7'/>" +
    "<path d='M120 112v-20l12-3v20'/><circle cx='118' cy='114' r='4'/><circle cx='129' cy='111' r='4'/>" +
    "<rect x='60' y='60' width='30' height='20' rx='3'/><circle cx='75' cy='70' r='6'/><path d='M66 60l3-4h12l3 4'/>" +
    "</g></svg>"
  ) + "\")";

  const who = (showIdentity && senderName && senderName.trim()) ? senderName.trim() : t('whatsapp.senderFallback');
  const greetName = (receiverName && receiverName.trim()) ? receiverName.trim() : t('whatsapp.recipientFallback');

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(5,5,5,0.08)", background: "#E4DDD3", fontFamily: WA_SANS, direction: isRtl ? 'rtl' : 'ltr' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
        background: "#F6F6F6", borderBottom: "1px solid rgba(0,0,0,0.08)", color: "#0A0A0A" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: "none", fontSize: 17, flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>{isRtl ? '›' : '‹'}</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>1</span>
        </div>
        <img src="/assets/JIGZO-Icon-Cream.svg" alt="JIGZO"
          style={{ width: 38, height: 38, borderRadius: "50%", flex: "none", display: "block", border: "1px solid rgba(0,0,0,0.1)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flex: 1, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: isRtl ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111B21", whiteSpace: "nowrap" }}>JIGZO</span>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#25D366", flex: "none",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>
        </div>
      </div>
      <div style={{ padding: "16px 12px 18px", backgroundColor: "#E4DDD3", backgroundImage: doodle }}>
        <div style={{ position: "relative", maxWidth: "86%", background: "#FFFFFF", borderRadius: isRtl ? "8px 0 8px 8px" : "0 8px 8px 8px",
          padding: "7px 9px 6px 11px", boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)", fontSize: 13.5, lineHeight: 1.4, color: "#111B21",
          marginRight: isRtl ? 0 : 'auto', marginLeft: isRtl ? 'auto' : 0 }}>
          <span style={{ position: "absolute", top: 0, left: isRtl ? "auto" : -7, right: isRtl ? -7 : "auto", width: 0, height: 0, borderStyle: "solid",
            borderWidth: isRtl ? "0 0 8px 8px" : "0 8px 8px 0", borderColor: isRtl ? "transparent transparent transparent #FFFFFF" : "transparent #FFFFFF transparent transparent" }} />
          <span style={{ whiteSpace: "pre-wrap" }}>
            {t('whatsapp.deliveryMessage', { recipient: greetName, sender: who })}{" "}
            <span style={{ color: "#0066cc", textDecoration: "underline", fontWeight: "600", cursor: "pointer" }}>
              {t('whatsapp.cta')}
            </span>
          </span>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 4, fontSize: 11, color: "#667781" }}>
            <span>{stamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
