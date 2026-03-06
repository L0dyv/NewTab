import { useRef, useState, useEffect } from 'react';
import { Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  downloadSettings,
  importSettingsFromFile,
  resetAllSettings,
  getAllSettings,
} from '@/lib/settingsManager';
import { getWebDAVConfig, setWebDAVConfig, testWebDAVConnection, uploadBackupToWebDAV, restoreFromWebDAV } from '@/lib/webdav';
import { useI18n } from '@/hooks/useI18n';

interface DataManagementSectionProps {
  onSettingsChanged?: () => void;
}

export default function DataManagementSection({ onSettingsChanged }: DataManagementSectionProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [testingWebdav, setTestingWebdav] = useState(false);
  const [syncingWebdav, setSyncingWebdav] = useState(false);
  const [showInsecureConfirm, setShowInsecureConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<"test" | "upload" | "restore" | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await getWebDAVConfig();
        setWebdavUrl(cfg.url || '');
        setWebdavUsername(cfg.username || '');
        setWebdavPassword(cfg.password || '');
      } catch { void 0; }
    };
    load();
  }, []);

  const protocolIsHttps = () => {
    try { return new URL(webdavUrl).protocol === 'https:'; } catch { return false; }
  };

  const performTest = async (allowInsecure: boolean) => {
    clearMessages();
    setTestingWebdav(true);
    try {
      const res = await testWebDAVConnection({ url: webdavUrl, username: webdavUsername, password: webdavPassword }, { allowInsecure });
      if (res.ok) {
        setSuccess(t('importExport.connectionOk'));
      } else {
        setError(res.message || `${t('importExport.connectionFailed')}（${res.status}）`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.connectionFailed'));
    } finally {
      setTestingWebdav(false);
    }
  };

  const performUpload = async (allowInsecure: boolean) => {
    clearMessages();
    setSyncingWebdav(true);
    try {
      await uploadBackupToWebDAV({ url: webdavUrl, username: webdavUsername, password: webdavPassword }, undefined, { allowInsecure });
      setSuccess(t('importExport.backupUploaded'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.uploadFailed'));
    } finally {
      setSyncingWebdav(false);
    }
  };

  const performRestore = async (allowInsecure: boolean) => {
    clearMessages();
    setSyncingWebdav(true);
    try {
      await restoreFromWebDAV({ url: webdavUrl, username: webdavUsername, password: webdavPassword }, { allowInsecure });
      setSuccess(t('importExport.settingsRestored'));
      onSettingsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.restoreFailed'));
    } finally {
      setSyncingWebdav(false);
    }
  };

  // 导出设置
  const handleExport = () => {
    clearMessages();
    try {
      downloadSettings();
      setSuccess(t('importExport.settingsExported'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.exportFailed'));
    }
  };

  // 触发文件选择
  const handleImportClick = () => {
    clearMessages();
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowImportConfirm(true);
    }
    event.target.value = '';
  };

  // 确认导入
  const confirmImport = async () => {
    if (!pendingFile) return;

    setImporting(true);
    setShowImportConfirm(false);

    try {
      await importSettingsFromFile(pendingFile);
      setSuccess(t('importExport.settingsImported'));
      onSettingsChanged?.();
    } catch (err) {
      console.error('Import settings failed', err);
      setError(err instanceof Error ? err.message : t('importExport.importFailed'));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  // 取消导入
  const cancelImport = () => {
    setShowImportConfirm(false);
    setPendingFile(null);
  };

  // 重置设置
  const handleReset = () => {
    clearMessages();
    setShowResetConfirm(true);
  };

  // 确认重置
  const confirmReset = () => {
    setShowResetConfirm(false);
    try {
      resetAllSettings();
      setSuccess(t('importExport.settingsReset'));
      onSettingsChanged?.();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importExport.resetFailed'));
    }
  };

  // 获取当前设置摘要
  const settings = getAllSettings();
  const summary = {
    searchEngines: settings.searchEngines.length,
    quickLinks: settings.quickLinks.length,
    theme: settings.theme === 'system' ? t('theme.system') : settings.theme === 'dark' ? t('theme.dark') : t('theme.light'),
  };

  return (
    <div className="p-6 space-y-6">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 当前设置摘要 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('importExport.currentSettings')}</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('importExport.searchEnginesCount')}</span>
            <p className="font-medium text-foreground">{summary.searchEngines} {t('importExport.unit')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('importExport.quickLinksCount')}</span>
            <p className="font-medium text-foreground">{summary.quickLinks} {t('importExport.unit')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('importExport.themeLabel')}</span>
            <p className="font-medium text-foreground">{summary.theme}</p>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleExport}
          variant="outline"
          className="flex-1 gap-2"
        >
          <Download className="h-4 w-4" />
          {t('importExport.exportBtn')}
        </Button>

        <Button
          onClick={handleImportClick}
          variant="outline"
          className="flex-1 gap-2"
          disabled={importing}
        >
          <Upload className="h-4 w-4" />
          {importing ? t('importExport.importing') : t('importExport.importBtn')}
        </Button>

        <Button
          onClick={handleReset}
          variant="outline"
          className="flex-1 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="h-4 w-4" />
          {t('importExport.resetBtn')}
        </Button>
      </div>

      {/* 云备份（WebDAV） */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('importExport.cloudBackup')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="webdav-url">{t('importExport.targetUrl')}</Label>
            <Input
              id="webdav-url"
              placeholder={t('importExport.targetUrlPlaceholder')}
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="webdav-username">{t('importExport.username')}</Label>
            <Input
              id="webdav-username"
              value={webdavUsername}
              onChange={(e) => setWebdavUsername(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="webdav-password">{t('importExport.password')}</Label>
            <Input
              id="webdav-password"
              type="password"
              value={webdavPassword}
              onChange={(e) => setWebdavPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={async () => {
              clearMessages();
              try {
                await setWebDAVConfig({ url: webdavUrl, username: webdavUsername, password: webdavPassword });
                setSuccess(t('importExport.configSaved'));
                setTimeout(() => setSuccess(null), 3000);
              } catch (err) {
                setError(err instanceof Error ? err.message : t('importExport.saveFailed'));
              }
            }}
          >
            {t('importExport.saveConfig')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={testingWebdav}
            onClick={async () => {
              if (protocolIsHttps()) {
                await performTest(false);
              } else {
                setPendingAction('test');
                setShowInsecureConfirm(true);
              }
            }}
          >
            {testingWebdav ? t('importExport.testing') : t('importExport.testConnection')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={syncingWebdav}
            onClick={async () => {
              if (protocolIsHttps()) {
                await performUpload(false);
              } else {
                setPendingAction('upload');
                setShowInsecureConfirm(true);
              }
            }}
          >
            {syncingWebdav ? t('importExport.uploading') : t('importExport.backupToCloud')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={syncingWebdav}
            onClick={async () => {
              if (protocolIsHttps()) {
                await performRestore(false);
              } else {
                setPendingAction('restore');
                setShowInsecureConfirm(true);
              }
            }}
          >
            {syncingWebdav ? t('importExport.restoring') : t('importExport.restoreFromCloud')}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>• {t('importExport.webdavHint1')}</p>
          <p>• {t('importExport.webdavHint2')}</p>
          <p>• {t('importExport.webdavHint3')}</p>
          <p>• {t('importExport.webdavHint4')}</p>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• {t('importExport.hint1')}</p>
        <p>• {t('importExport.hint2')}</p>
        <p>• {t('importExport.hint3')}</p>
      </div>

      {/* 成功/错误消息 */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-stone-200/50 dark:bg-stone-800/50 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-sm">
          {success}
        </div>
      )}

      {/* 导入确认对话框 */}
      <AlertDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importExport.confirmImportTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('importExport.confirmImportDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelImport}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>{t('importExport.confirmImportBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重置确认对话框 */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importExport.confirmResetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('importExport.confirmResetDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('importExport.confirmResetBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showInsecureConfirm} onOpenChange={setShowInsecureConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('importExport.insecureTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('importExport.insecureDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowInsecureConfirm(false); setPendingAction(null); }}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setShowInsecureConfirm(false)
              const action = pendingAction
              setPendingAction(null)
              if (action === 'test') await performTest(true)
              else if (action === 'upload') await performUpload(true)
              else if (action === 'restore') await performRestore(true)
            }}>{t('importExport.continue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
