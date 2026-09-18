export function recipientPresentationRows(persistedRows, drafts, selectedOrder) {
  const selectedPersisted = new Set(selectedOrder.map(item => item.recipientId).filter(Boolean));
  const selectedDrafts = new Set(selectedOrder.map(item => item.localId));
  const persistedById = new Map(persistedRows.map(row => [row.recipientId, row]));
  const draftById = new Map(drafts.map(row => [row.localId, row]));
  return [
    ...persistedRows.filter(row => !selectedPersisted.has(row.recipientId)),
    ...drafts.filter(row => !selectedDrafts.has(row.localId)),
    ...selectedOrder.map(item => item.recipientId ? persistedById.get(item.recipientId) : draftById.get(item.localId)).filter(Boolean)
  ];
}
