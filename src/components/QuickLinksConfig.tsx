import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import DraggableRow from "@/components/DraggableRow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useI18n } from "@/hooks/useI18n";
import { isLocalHostname } from "@/lib/url";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";
import GroupTabs from "@/components/GroupTabs";
import { applyQuickLinkEdit, updateQuickLinkDraft } from "@/lib/quickLinkGroups";

interface QuickLinksConfigProps {
  links: QuickLink[];
  onLinksChange: (links: QuickLink[]) => void;
  groups: QuickLinkGroup[];
  onGroupsChange: (groups: QuickLinkGroup[]) => void;
  hideHeader?: boolean;
}

// 规范化URL：自动添加https://前缀（如果需要）
const normalizeUrl = (url: string): string => {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return trimmedUrl;

  // 如果已经有协议前缀（http://, https://, file://, etc.），直接返回
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl)) {
    return trimmedUrl;
  }

  // 检查是否看起来像一个域名（包含.且不含空格）
  // localhost / private IPs: prefer http://
  if (!/\s/.test(trimmedUrl)) {
    try {
      const hostname = new URL(`http://${trimmedUrl}`).hostname;
      if (isLocalHostname(hostname)) {
        return `http://${trimmedUrl}`;
      }
    } catch {
      /* ignore */
    }
  }

  if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    return `https://${trimmedUrl}`;
  }

  // 其他情况原样返回
  return trimmedUrl;
};

const QuickLinksConfig = ({ links, onLinksChange, groups, onGroupsChange }: QuickLinksConfigProps) => {
  const { t } = useI18n();
  const [activeGroupFilter, setActiveGroupFilter] = useState('all');
  const [newLink, setNewLink] = useState({ name: "", url: "", groupId: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState({ name: "", url: "", groupId: "" });
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);

  // 使用固定的 sensors 配置，避免动态变化导致 dnd-kit 崩溃
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 编辑模式下禁用拖拽
      activationConstraint: editingId ? { distance: Infinity } : undefined,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 通过 background.js 获取网页标题
  const fetchPageTitle = async (url: string): Promise<string> => {
    console.log('[QuickLinks] 开始获取标题:', url);
    console.log('[QuickLinks] chrome 对象:', typeof chrome);
    console.log('[QuickLinks] chrome.runtime:', typeof chrome !== 'undefined' ? chrome.runtime : 'undefined');

    return new Promise((resolve) => {
      // 检查是否在扩展环境中
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        console.log('[QuickLinks] 发送消息到 background...');
        chrome.runtime.sendMessage<{ success: boolean; title?: string }>(
          { type: 'FETCH_PAGE_TITLE', url },
          (response) => {
            console.log('[QuickLinks] 收到响应:', response);
            if (response?.success && response.title) {
              resolve(response.title);
            } else {
              // 失败时使用域名
              try {
                const urlObj = new URL(url);
                resolve(urlObj.hostname.replace('www.', ''));
              } catch {
                resolve(url);
              }
            }
          }
        );
      } else {
        console.log('[QuickLinks] 不在扩展环境中，使用域名');
        // 非扩展环境，使用域名
        try {
          const urlObj = new URL(url);
          resolve(urlObj.hostname.replace('www.', ''));
        } catch {
          resolve(url);
        }
      }
    });
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('skipConfirmDeleteQuickLinks');
      setSkipDeleteConfirm(saved === 'true');
    } catch {
      setSkipDeleteConfirm(false);
    }
  }, []);

  const updateSkipConfirm = (next: boolean) => {
    setSkipDeleteConfirm(next);
    try {
      localStorage.setItem('skipConfirmDeleteQuickLinks', String(next));
    } catch {
      /* ignore */
    }
  };

  // 根据分组过滤显示链接
  const filteredLinks = activeGroupFilter === 'all'
    ? links
    : activeGroupFilter === '__ungrouped__'
      ? links.filter(l => !l.groupId)
      : links.filter(l => l.groupId === activeGroupFilter);

  const addLink = async () => {
    if (newLink.url) {
      setIsLoading(true);
      try {
        const normalizedUrl = normalizeUrl(newLink.url);

        // 如果没有填写名称，自动获取
        let linkName = newLink.name.trim();
        if (!linkName) {
          linkName = await fetchPageTitle(normalizedUrl);
        }

        const id = linkName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        const groupId = newLink.groupId || undefined;
        onLinksChange([...links, { name: linkName, url: normalizedUrl, id, enabled: true, groupId }]);
        setNewLink({ name: "", url: "", groupId: newLink.groupId });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const removeLink = (id: string) => {
    const filteredLinks = links.filter(link => link.id !== id);
    onLinksChange(filteredLinks);
  };

  const startEditing = (link: QuickLink) => {
    setEditingId(link.id);
    setEditingLink({ name: link.name, url: link.url, groupId: link.groupId ?? "" });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingLink({ name: "", url: "", groupId: "" });
  };

  const saveEditing = async () => {
    if (editingId && editingLink.url) {
      setIsEditLoading(true);
      try {
        const normalizedUrl = normalizeUrl(editingLink.url);

        // 如果没有填写名称，自动获取
        let linkName = editingLink.name.trim();
        if (!linkName) {
          linkName = await fetchPageTitle(normalizedUrl);
        }

        const updatedLinks = applyQuickLinkEdit(links, editingId, {
          ...editingLink,
          name: linkName,
          url: normalizedUrl,
        });
        onLinksChange(updatedLinks);
        setEditingId(null);
        setEditingLink({ name: "", url: "", groupId: "" });
      } finally {
        setIsEditLoading(false);
      }
    }
  };

  const resetToDefault = () => {
    onLinksChange([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = links.findIndex(link => link.id === active.id);
      const newIndex = links.findIndex(link => link.id === over?.id);

      onLinksChange(arrayMove(links, oldIndex, newIndex));
    }
  };

  const toggleEnabled = (id: string, enabled: boolean) => {
    const updatedLinks = links.map(link =>
      link.id === id ? { ...link, enabled } : link
    );
    onLinksChange(updatedLinks);
  };

  return (
    <div className="space-y-0">
      {/* 分组标签栏 */}
      <GroupTabs
        groups={groups}
        links={links}
        activeGroupFilter={activeGroupFilter}
        onActiveGroupFilterChange={setActiveGroupFilter}
        onGroupsChange={onGroupsChange}
        onLinksChange={onLinksChange}
      />

      <div className="p-6 space-y-6">
      {/* 现有快速链接列表 */}
      {filteredLinks.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredLinks.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <div>
                {filteredLinks.map((link) => (
                  <DraggableRow
                    key={link.id}
                    link={link}
                    groups={groups}
                    isEditing={editingId === link.id}
                    editingLink={editingLink}
                    isEditLoading={isEditLoading}
                    skipDeleteConfirm={skipDeleteConfirm}
                    onEditingLinkChange={(value) => setEditingLink((current) => updateQuickLinkDraft(current, value))}
                    onStartEditing={startEditing}
                    onSaveEditing={saveEditing}
                    onCancelEditing={cancelEditing}
                    onRemoveLink={removeLink}
                    onToggleEnabled={toggleEnabled}
                    onConfirmDelete={setConfirmDeleteId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* 添加新快速链接 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('quickLinks.addNew')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label htmlFor="linkName" className="text-xs">{t('quickLinks.name')}</Label>
            <Input
              id="linkName"
              value={newLink.name}
              onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
              placeholder={t('quickLinks.namePlaceholder')}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="linkUrl" className="text-xs">{t('quickLinks.url')}</Label>
            <Input
              id="linkUrl"
              value={newLink.url}
              onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              placeholder={t('quickLinks.urlPlaceholder')}
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
          </div>
          {groups.length > 0 && (
            <div>
              <Label htmlFor="linkGroup" className="text-xs">{t('quickLinks.group')}</Label>
              <select
                id="linkGroup"
                value={newLink.groupId}
                onChange={(e) => setNewLink({ ...newLink, groupId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t('quickLinks.ungrouped')}</option>
                {groups.sort((a, b) => a.order - b.order).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <Button onClick={addLink} size="sm" className="w-full h-9" disabled={isLoading || !newLink.url}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {isLoading ? t('quickLinks.fetchingTitle') : t('common.add')}
            </Button>
          </div>
        </div>
        {links.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('quickLinks.dragHint')}
          </p>
        )}
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('quickLinks.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('quickLinks.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="skipConfirmLinks"
              checked={skipDeleteConfirm}
              onCheckedChange={(val) => updateSkipConfirm(Boolean(val))}
            />
            <Label htmlFor="skipConfirmLinks" className="text-sm">{t('quickLinks.skipConfirm')}</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) {
                  removeLink(confirmDeleteId);
                }
                setConfirmDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('quickLinks.confirmDeleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
};

export default QuickLinksConfig;
