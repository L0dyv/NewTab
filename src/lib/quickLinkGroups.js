export function updateQuickLinkDraft(draft, patch) {
  return {
    ...draft,
    ...patch,
  };
}

export function applyQuickLinkEdit(links, editingId, draft) {
  return links.map((link) =>
    link.id === editingId
      ? {
          ...link,
          name: draft.name,
          url: draft.url,
          groupId: draft.groupId || undefined,
        }
      : link
  );
}
