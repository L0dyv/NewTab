import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Bot, GripVertical, RotateCcw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { defaultSearchEngines, mergeBuiltinEngines } from "@/lib/defaultSearchEngines";

interface SearchEngine {
  id: string;
  name: string;
  url: string;
  isDefault?: boolean;
  isAI?: boolean;
  enabled?: boolean;
}

interface SearchEngineConfigProps {
  engines: SearchEngine[];
  onEnginesChange: (engines: SearchEngine[]) => void;
}

interface SortableEngineItemProps {
  engine: SearchEngine;
  onSetDefault: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  skipDeleteConfirm: boolean;
  onRequestDelete: (id: string) => void;
}

function SortableEngineItem({ engine, onSetDefault, onToggleEnabled, skipDeleteConfirm, onRequestDelete }: SortableEngineItemProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: engine.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 判断是否为当前默认搜索引擎
  const isCurrentDefault = engine.isDefault;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 bg-background ${isDragging ? 'shadow-md z-50 cursor-grabbing rounded-md border border-border' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className={`drag-handle text-muted-foreground hover:text-foreground touch-none ${isDragging ? 'drag-handle-active' : ''}`}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{engine.name}</span>
          {engine.isAI && (
            <span className="flex items-center gap-1 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-1.5 py-0.5 rounded text-xs font-medium">
              <Bot className="h-3 w-3" />
              AI
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {engine.isAI ? t('searchEngines.aiSearch') : engine.url}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {engine.isDefault ? (
          <span className="bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 px-2 py-0.5 rounded text-xs font-medium">
            {t('searchEngines.isDefault')}
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetDefault(engine.id)}
            className="h-7 text-xs px-2"
          >
            {t('searchEngines.setDefault')}
          </Button>
        )}
        {!engine.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRequestDelete(engine.id)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <Checkbox
        checked={engine.enabled !== false}
        onCheckedChange={(checked) => onToggleEnabled(engine.id, Boolean(checked))}
        disabled={isCurrentDefault}
        title={isCurrentDefault ? t('searchEngines.defaultCannotDisable') : ""}
        className="flex-shrink-0"
      />
    </div>
  );
}

const SearchEngineConfig = ({ engines, onEnginesChange }: SearchEngineConfigProps) => {
  const { t } = useI18n();
  const [newEngine, setNewEngine] = useState({ name: "", url: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('skipConfirmDeleteSearchEngines');
      setSkipDeleteConfirm(saved === 'true');
    } catch {
      setSkipDeleteConfirm(false);
    }
  }, []);

  const updateSkipConfirm = (next: boolean) => {
    setSkipDeleteConfirm(next);
    try {
      localStorage.setItem('skipConfirmDeleteSearchEngines', String(next));
    } catch {
      /* ignore */
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addEngine = () => {
    if (newEngine.name && newEngine.url) {
      const id = newEngine.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      onEnginesChange([...engines, { ...newEngine, id }]);
      setNewEngine({ name: "", url: "" });
    }
  };

  const removeEngine = (id: string) => {
    // 防止删除默认搜索引擎
    const targetEngine = engines.find(e => e.id === id);
    if (targetEngine?.isDefault) {
      return;
    }

    // 记录内置引擎的删除
    const isBuiltin = defaultSearchEngines.some(e => e.id === id);
    if (isBuiltin) {
      const del = JSON.parse(localStorage.getItem("deletedBuiltinIds") ?? "[]");
      if (!del.includes(id)) {
        del.push(id);
        localStorage.setItem("deletedBuiltinIds", JSON.stringify(del));
      }
    }

    const remaining = engines.filter(engine => engine.id !== id);
    const currentId = localStorage.getItem('currentSearchEngine') ?? '';
    if (currentId === id) {
      const fallback = remaining.find(e => e.isDefault)?.id || remaining[0]?.id || 'google';
      try { localStorage.setItem('currentSearchEngine', fallback); } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('settings:updated')); } catch { /* ignore */ }
    }

    onEnginesChange(remaining);
  };

  const setDefault = (id: string) => {
    onEnginesChange(
      engines.map(engine => ({
        ...engine,
        isDefault: engine.id === id,
        enabled: engine.id === id ? true : engine.enabled,
      }))
    );
  };

  const resetToDefault = () => {
    localStorage.removeItem('deletedBuiltinIds'); // 清除删除记录
    onEnginesChange([...defaultSearchEngines]);
    localStorage.removeItem('currentSearchEngine');
  };

  const toggleEnabled = (id: string, enabled: boolean) => {
    // 默认搜索引擎不允许取消勾选
    const targetEngine = engines.find(e => e.id === id);
    if (targetEngine?.isDefault && !enabled) {
      return; // 不允许取消默认搜索引擎
    }

    onEnginesChange(engines.map(engine =>
      engine.id === id ? { ...engine, enabled } : engine
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = engines.findIndex(engine => engine.id === active.id);
      const newIndex = engines.findIndex(engine => engine.id === over?.id);

      onEnginesChange(arrayMove(engines, oldIndex, newIndex));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefault}
          className="flex items-center gap-1 h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          {t('searchEngines.resetToDefault')}
        </Button>
      </div>

      {/* 现有搜索引擎列表 */}
      <div className="rounded-lg border border-border overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={engines.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div>
              {engines.map((engine) => (
                <SortableEngineItem
                  key={engine.id}
                  engine={engine}
                  onSetDefault={setDefault}
                  onToggleEnabled={toggleEnabled}
                  skipDeleteConfirm={skipDeleteConfirm}
                  onRequestDelete={(id) => {
                    if (skipDeleteConfirm) {
                      removeEngine(id);
                    } else {
                      setConfirmDeleteId(id);
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* 添加新搜索引擎 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('searchEngines.addNew')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="name" className="text-xs">{t('searchEngines.name')}</Label>
            <Input
              id="name"
              value={newEngine.name}
              onChange={(e) => setNewEngine({ ...newEngine, name: e.target.value })}
              placeholder={t('searchEngines.namePlaceholder')}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="url" className="text-xs">{t('searchEngines.url')}</Label>
            <Input
              id="url"
              value={newEngine.url}
              onChange={(e) => setNewEngine({ ...newEngine, url: e.target.value })}
              placeholder="https://example.com/search?q="
              className="h-9 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addEngine} size="sm" className="w-full h-9">
              <Plus className="h-4 w-4 mr-1" />
              {t('common.add')}
            </Button>
          </div>
        </div>
      </div>

      {/* Kagi Assistant 说明 */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-start gap-2">
          <Bot className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-medium text-foreground mb-1">
              {t('searchEngines.aboutKagi')}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t('searchEngines.kagiDesc')}
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('searchEngines.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('searchEngines.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="skipConfirmEngines"
              checked={skipDeleteConfirm}
              onCheckedChange={(val) => updateSkipConfirm(Boolean(val))}
            />
            <Label htmlFor="skipConfirmEngines" className="text-sm">{t('searchEngines.skipConfirm')}</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteId(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) {
                  removeEngine(confirmDeleteId);
                }
                setConfirmDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('searchEngines.confirmDeleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SearchEngineConfig;
