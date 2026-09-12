import { ReactNode, useEffect, useCallback } from "react";
import * as React from "react";
import {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogPortal,
    DialogOverlay,
    DialogDescription,
} from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface SettingsModalProps {
    title: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    children: ReactNode;
    dirty?: boolean;
}

// 自定义 DialogContent，不包含默认的关闭按钮
const CustomDialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { onClose?: () => void }
>(({ className, children, onClose, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2",
                "overflow-visible outline-none",
                className
            )}
            {...props}
        >
            {/* 关闭按钮作为模态框的子元素，绝对定位到右上角外侧 */}
            <button
                onClick={onClose}
                type="button"
                className="liquid-glass liquid-glass-floating absolute -top-4 -right-4 z-[100] rounded-full p-2.5 text-foreground hover:text-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                aria-label={t('common.close')}
            >
                <X className="h-5 w-5" />
            </button>
            <VisuallyHidden.Root asChild>
                <DialogDescription>{t('settings.dialog')}</DialogDescription>
            </VisuallyHidden.Root>
            <div className="liquid-glass liquid-glass-floating max-h-[90vh] overflow-hidden rounded-2xl">
                {children}
            </div>
        </DialogPrimitive.Content>
    </DialogPortal>
));
CustomDialogContent.displayName = "CustomDialogContent";

export default function SettingsModal({
    title,
    open,
    onOpenChange,
    children,
    dirty = false,
}: SettingsModalProps) {
    // 关闭时拦截：有脏数据就二次确认
    const handleClose = useCallback(() => {
        if (!dirty || window.confirm(t('settings.unsavedConfirm'))) {
            onOpenChange(false);
        }
    }, [dirty, onOpenChange]);

    // 监听 ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, handleClose]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <CustomDialogContent onClose={handleClose}>
                <DialogHeader className="border-b border-foreground/10 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold">
                        {title}
                    </DialogTitle>
                </DialogHeader>
                {children}
            </CustomDialogContent>
        </Dialog>
    );
} 
