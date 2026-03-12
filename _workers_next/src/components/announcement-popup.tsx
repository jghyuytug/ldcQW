"use client"

import { useEffect, useState } from "react"
import { BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n/context"
import ReactMarkdown from "react-markdown"

const DISMISSED_SIGNATURE_KEY = "announcement-popup:dismissed-signature"

type AnnouncementPopupData = {
    title: string | null
    content: string
    signature: string
} | null

function getDismissedSignature(): string | null {
    try {
        return localStorage.getItem(DISMISSED_SIGNATURE_KEY)
    } catch {
        return null
    }
}

function setDismissedSignature(signature: string) {
    try {
        localStorage.setItem(DISMISSED_SIGNATURE_KEY, signature)
    } catch {
        // Ignore storage failures and keep the popup functional.
    }
}

export function AnnouncementPopup({ popup }: { popup: AnnouncementPopupData }) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!popup?.content?.trim()) {
            setOpen(false)
            return
        }

        setOpen(getDismissedSignature() !== popup.signature)
    }, [popup])

    const dismiss = () => {
        if (popup?.signature) {
            setDismissedSignature(popup.signature)
        }
        setOpen(false)
    }

    if (!popup?.content?.trim()) {
        return null
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    dismiss()
                    return
                }
                setOpen(true)
            }}
        >
            <DialogContent className="overflow-hidden border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur sm:max-w-xl">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
                    <DialogHeader className="gap-3 text-left">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <BellRing className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
                                    {t("announcement.popupLabel")}
                                </p>
                                <DialogTitle className="text-xl">
                                    {popup.title?.trim() || t("announcement.popupDefaultTitle")}
                                </DialogTitle>
                            </div>
                        </div>
                    </DialogHeader>
                </div>
                <div className="px-6 pb-6">
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm leading-6 text-foreground/90">
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{popup.content}</ReactMarkdown>
                        </div>
                    </div>
                    <DialogFooter className="mt-5">
                        <Button onClick={dismiss} className="min-w-28">
                            {t("announcement.popupConfirm")}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
