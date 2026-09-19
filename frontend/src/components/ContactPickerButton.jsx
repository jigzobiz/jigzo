import React, { useEffect, useState } from 'react';
import { nextContactSelectionBatchId, pickerAvailable, partitionContactSelection, startPickerSelection } from '../utils/contactPicker';

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
    startPickerSelection(setPending);
    setBusy(true);
    try {
      // This call is made directly from the click gesture; access is never persistent.
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      const { immediate, pending: choices } = partitionContactSelection(contacts, nextContactSelectionBatchId());
      if (immediate.length) onSelect(immediate);
      setPending(choices);
    } catch (err) {
      if (err?.name !== 'AbortError') setError(isArabic ? 'تعذر فتح جهات الاتصال. يمكنك إدخال الرقم يدويًا.' : 'Could not open contacts. You can enter the number manually.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" onClick={open} disabled={busy} className="contact-picker-button">
      {isArabic ? 'اختيار من جهات الاتصال' : 'Choose from contacts'}
    </button>
    {error && <div role="status" className="contact-picker-note">{error}</div>}
    {!!pending.length && <div className="contact-picker-choices">
      <strong>{isArabic ? 'اختر رقمًا لكل جهة اتصال لديها عدة أرقام' : 'Choose a number for each contact with multiple numbers'}</strong>
      {pending.map(row => <label key={`${row.batchId}-${row.selectionOrder}`}>
        <span>{row.name || (isArabic ? 'جهة اتصال' : 'Contact')}</span>
        <select value={row.choice} onChange={event => {
          if (!event.target.value) return;
          onSelect([{ name: row.name, phone: event.target.value, batchId: row.batchId, selectionOrder: row.selectionOrder }]);
          setPending(current => current.filter(item => item.selectionOrder !== row.selectionOrder || item.batchId !== row.batchId));
        }}>
          <option value="">{isArabic ? 'اختر رقمًا' : 'Choose a number'}</option>
          {row.numbers.map((number, i) => <option key={`${number}-${i}`} value={number}>{number}</option>)}
        </select>
      </label>)}
      <div className="contact-picker-actions">
        <button type="button" onClick={() => setPending([])}>{isArabic ? 'إلغاء' : 'Cancel'}</button>
      </div>
    </div>}
  </>;
}
