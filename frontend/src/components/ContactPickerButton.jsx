import React, { useEffect, useState } from 'react';
import { pickerAvailable, selectedContactRows } from '../utils/contactPicker';

export default function ContactPickerButton({ onSelect, isArabic = false }) {
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pickerAvailable()) return;
    let active = true;
    navigator.contacts.getProperties().then(properties => {
      if (active && properties.includes('name') && properties.includes('tel')) setSupported(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!supported) return null;

  const open = async () => {
    setError('');
    setBusy(true);
    try {
      // This call is made directly from the click gesture; access is never persistent.
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      const rows = selectedContactRows(contacts).map(row => ({ ...row, choice: row.numbers.length === 1 ? row.numbers[0] : '' }));
      if (!rows.length) return;
      if (rows.some(row => row.numbers.length > 1)) setPending(rows);
      else onSelect(rows.map(row => ({ name: row.name, phone: row.choice })));
    } catch (err) {
      if (err?.name !== 'AbortError') setError(isArabic ? 'تعذر فتح جهات الاتصال. يمكنك إدخال الرقم يدويًا.' : 'Could not open contacts. You can enter the number manually.');
    } finally {
      setBusy(false);
    }
  };

  return <div>
    <button type="button" onClick={open} disabled={busy} className="contact-picker-button">
      {isArabic ? 'اختيار من جهات الاتصال' : 'Choose from contacts'}
    </button>
    {error && <div role="status" className="contact-picker-note">{error}</div>}
    {!!pending.length && <div className="contact-picker-choices">
      <strong>{isArabic ? 'اختر رقمًا لكل جهة اتصال لديها عدة أرقام' : 'Choose a number for each contact with multiple numbers'}</strong>
      {pending.map((row, index) => <label key={index}>
        <span>{row.name || (isArabic ? 'جهة اتصال' : 'Contact')}</span>
        {row.numbers.length > 1 ? <select value={row.choice} onChange={event => setPending(current => current.map((item, i) => i === index ? { ...item, choice: event.target.value } : item))}>
          <option value="">{isArabic ? 'اختر رقمًا' : 'Choose a number'}</option>
          {row.numbers.map((number, i) => <option key={`${number}-${i}`} value={number}>{number}</option>)}
        </select> : <span>{row.choice || (isArabic ? 'لا يوجد رقم؛ يمكن التعديل لاحقًا' : 'No number; edit it below')}</span>}
      </label>)}
      <div className="contact-picker-actions">
        <button type="button" disabled={pending.some(row => row.numbers.length > 1 && !row.choice)} onClick={() => {
          onSelect(pending.map(row => ({ name: row.name, phone: row.choice })));
          setPending([]);
        }}>{isArabic ? 'إضافة المحددين' : 'Add selected contacts'}</button>
        <button type="button" onClick={() => setPending([])}>{isArabic ? 'إلغاء' : 'Cancel'}</button>
      </div>
    </div>}
  </div>;
}
