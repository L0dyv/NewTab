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

export function renameQuickLinkGroup(groups, groupId, name) {
  return groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          name,
        }
      : group
  );
}

export function reorderQuickLinkGroups(groups, activeId, overId) {
  if (!overId || activeId === overId) {
    return groups;
  }

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);
  const oldIndex = sortedGroups.findIndex((group) => group.id === activeId);
  const newIndex = sortedGroups.findIndex((group) => group.id === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return groups;
  }

  const reordered = [...sortedGroups];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  return reordered.map((group, index) => ({
    ...group,
    order: index,
  }));
}

export function deleteQuickLinkGroup(groups, links, groupId) {
  return {
    groups: groups.filter((group) => group.id !== groupId),
    links: links.map((link) =>
      link.groupId === groupId
        ? {
            ...link,
            groupId: undefined,
          }
        : link
    ),
  };
}
