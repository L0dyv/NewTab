import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, GripVertical, Loader2, Pencil, Check, X } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { t } from "@/lib/i18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

interface DraggableRowProps {
    link: QuickLink;
    groups: QuickLinkGroup[];
    isEditing: boolean;
    editingLink: { name: string; url: string; groupId: string };
    isEditLoading: boolean;
    skipDeleteConfirm: boolean;
    onEditingLinkChange: (value: { name: string; url: string; groupId: string }) => void;
    onStartEditing: (link: QuickLink) => void;
    onSaveEditing: () => void;
    onCancelEditing: () => void;
    onRemoveLink: (id: string) => void;
    onToggleEnabled: (id: string, enabled: boolean) => void;
    onConfirmDelete: (id: string) => void;
}

const DraggableRow = ({
    link,
    groups,
    isEditing,
    editingLink,
    isEditLoading,
    skipDeleteConfirm,
    onEditingLinkChange,
    onStartEditing,
    onSaveEditing,
    onCancelEditing,
    onRemoveLink,
    onToggleEnabled,
    onConfirmDelete,
}: DraggableRowProps) => {
    const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: link.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onToggleEnabled(link.id, e.target.checked);
    };

    const handleRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (skipDeleteConfirm) {
            onRemoveLink(link.id);
        } else {
            onConfirmDelete(link.id);
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartEditing(link);
    };

    const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

    if (isEditing) {
        // 编辑模式下不应用拖拽属性，避免干扰中文输入法
        return (
            <div ref={setNodeRef} style={style}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 bg-muted/30 overflow-hidden max-w-full">
                <div className={`flex-1 min-w-0 grid grid-cols-1 gap-2 ${groups.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    <Input
                        value={editingLink.name}
                        onChange={(e) => onEditingLinkChange({ ...editingLink, name: e.target.value })}
                        placeholder={t('quickLinks.namePlaceholder')}
                        disabled={isEditLoading}
                        autoFocus
                        className="h-8 text-sm"
                    />
                    <Input
                        value={editingLink.url}
                        onChange={(e) => onEditingLinkChange({ ...editingLink, url: e.target.value })}
                        placeholder={t('quickLinks.urlPlaceholder')}
                        disabled={isEditLoading}
                        className="h-8 text-sm"
                    />
                    {groups.length > 0 && (
                        <select
                            value={editingLink.groupId}
                            onChange={(e) => onEditingLinkChange({ ...editingLink, groupId: e.target.value })}
                            disabled={isEditLoading}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="">{t('quickLinks.ungrouped')}</option>
                            {sortedGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSaveEditing}
                    disabled={!editingLink.url || isEditLoading}
                    className="h-7 w-7 p-0 text-foreground hover:text-foreground/80"
                >
                    {isEditLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancelEditing}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style}
            className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 bg-background overflow-hidden max-w-full">
            <div {...attributes} {...listeners} className="drag-handle text-muted-foreground hover:text-foreground flex-shrink-0 touch-none">
                <GripVertical className="h-4 w-4" />
            </div>
            <Checkbox
                checked={link.enabled === true}
                onCheckedChange={(checked) => onToggleEnabled(link.id, Boolean(checked))}
                className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate">{link.name}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{link.url}</div>
            </div>
            <div className="flex-shrink-0 flex gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditClick}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveClick}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
};

export default DraggableRow;
export type { QuickLink, DraggableRowProps };
