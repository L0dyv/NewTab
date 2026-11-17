import { useCallback, useEffect, useRef, useState } from "react";
import type { QuickLink } from "@/lib/types";

interface UseInlineLinkRenameOptions {
  link: QuickLink;
  onRename: (linkId: string, name: string) => void;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * 快速链接的内联重命名状态机，供 Dock 扇形项与网格/Launchpad 的 LinkTile 共用。
 *
 * 两个细节：
 * 1. 输入框挂载后延迟一帧再 focus/select，避开 Radix ContextMenu 在 onSelect
 *    同步阶段尚未释放的 FocusScope 焦点捕获。
 * 2. 用 settledRef 保证一次编辑会话最多提交或取消一次，避免 Enter/Escape 之后
 *    紧接着触发的 blur 重复提交或把已取消的草稿写回去。
 */
export function useInlineLinkRename({
  link,
  onRename,
  onEditingChange,
}: UseInlineLinkRenameOptions) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;

  useEffect(() => {
    if (!isRenaming) return;
    onEditingChangeRef.current?.(true);
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(raf);
      onEditingChangeRef.current?.(false);
    };
  }, [isRenaming]);

  const startRename = useCallback(() => {
    settledRef.current = false;
    setDraftName(link.name);
    setIsRenaming(true);
  }, [link.name]);

  const commitRename = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    const nextName = draftName.trim();
    if (nextName && nextName !== link.name) {
      onRename(link.id, nextName);
    }
    setIsRenaming(false);
  }, [draftName, link.id, link.name, onRename]);

  const cancelRename = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setIsRenaming(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        commitRename();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelRename();
        return;
      }
      e.stopPropagation();
    },
    [cancelRename, commitRename]
  );

  return {
    isRenaming,
    draftName,
    setDraftName,
    inputRef,
    startRename,
    commitRename,
    handleKeyDown,
  };
}
