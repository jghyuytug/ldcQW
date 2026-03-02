import { getSetting } from "./db/queries"

export async function getNotificationSettings() {
    const [
        token,
        chatId,
        languageRaw,
        barkEnabledRaw,
        barkServerUrlRaw,
        barkDeviceKeyRaw
    ] = await Promise.all([
        getSetting('telegram_bot_token'),
        getSetting('telegram_chat_id'),
        getSetting('telegram_language'),
        getSetting('bark_enabled'),
        getSetting('bark_server_url'),
        getSetting('bark_device_key')
    ])

    const language = languageRaw || 'zh' // 默认中文
    const barkEnabled = barkEnabledRaw === 'true'
    const barkServerUrl = (barkServerUrlRaw || 'https://api.day.app').trim() || 'https://api.day.app'
    const barkDeviceKey = (barkDeviceKeyRaw || '').trim()

    return {
        token,
        chatId,
        language,
        barkEnabled,
        barkServerUrl,
        barkDeviceKey
    }
}

export async function sendTelegramMessage(text: string) {
    try {
        const { token, chatId } = await getNotificationSettings()

        if (!token || !chatId) {
            console.log('[Notification] Skipped: Missing token or chat_id')
            return { success: false, error: 'Missing configuration' }
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`
        const body = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[Notification] Telegram API Error:', error)
            return { success: false, error }
        }

        return { success: true }
    } catch (e: any) {
        console.error('[Notification] Send Error:', e)
        return { success: false, error: e.message }
    }
}

function normalizeBarkServerUrl(raw: string) {
    const trimmed = (raw || "").trim()
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProtocol)
    const pathname = parsed.pathname.replace(/\/+$/, "")
    return `${parsed.origin}${pathname}`
}

export async function sendBarkMessage(
    title: string,
    body: string,
    options?: { url?: string; group?: string }
) {
    try {
        const { barkEnabled, barkServerUrl, barkDeviceKey } = await getNotificationSettings()

        if (!barkEnabled) {
            console.log('[Notification] Bark skipped: disabled')
            return { success: false, error: 'Bark disabled' }
        }

        if (!barkDeviceKey) {
            console.log('[Notification] Bark skipped: missing device key')
            return { success: false, error: 'Missing Bark device key' }
        }

        const baseUrl = normalizeBarkServerUrl(barkServerUrl || 'https://api.day.app')
        const safeTitle = (title || 'LDC Shop').trim() || 'LDC Shop'
        const safeBody = (body || '-').trim() || '-'

        let requestUrl = `${baseUrl}/${encodeURIComponent(barkDeviceKey)}/${encodeURIComponent(safeTitle)}/${encodeURIComponent(safeBody)}`
        const query = new URLSearchParams()
        if (options?.url) query.set('url', options.url)
        if (options?.group) query.set('group', options.group)
        const queryString = query.toString()
        if (queryString) {
            requestUrl += `?${queryString}`
        }

        const response = await fetch(requestUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json, text/plain;q=0.9, */*;q=0.8'
            },
            cache: 'no-store'
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[Notification] Bark API Error:', error)
            return { success: false, error }
        }

        return { success: true }
    } catch (e: any) {
        console.error('[Notification] Bark Send Error:', e)
        return { success: false, error: e.message }
    }
}

// 消息模板
const messages = {
    zh: {
        paymentTitle: '💰 收到新付款！',
        order: '订单号',
        product: '商品',
        amount: '金额',
        user: '用户',
        tradeNo: '交易号',
        guest: '访客',
        noEmail: '无邮箱',
        refundTitle: '↩️ 收到退款申请',
        reason: '原因',
        noReason: '未提供原因',
        manageRefunds: '管理退款'
    },
    en: {
        paymentTitle: '💰 New Payment Received!',
        order: 'Order',
        product: 'Product',
        amount: 'Amount',
        user: 'User',
        tradeNo: 'Trade No',
        guest: 'Guest',
        noEmail: 'No email',
        refundTitle: '↩️ Refund Requested',
        reason: 'Reason',
        noReason: 'No reason provided',
        manageRefunds: 'Manage Refunds'
    }
}

export async function notifyAdminPaymentSuccess(order: {
    orderId: string,
    productName: string,
    amount: string,
    email?: string | null,
    username?: string | null,
    tradeNo?: string | null
}) {
    const { language } = await getNotificationSettings()
    const t = messages[language as keyof typeof messages] || messages.zh

    const telegramText = `
<b>${t.paymentTitle}</b>

<b>${t.order}:</b> <code>${order.orderId}</code>
<b>${t.product}:</b> ${order.productName}
<b>${t.amount}:</b> ${order.amount}
<b>${t.user}:</b> ${order.username || t.guest} (${order.email || t.noEmail})
<b>${t.tradeNo}:</b> <code>${order.tradeNo || 'N/A'}</code>
`.trim()

    const barkBody = [
        `${t.order}: ${order.orderId}`,
        `${t.product}: ${order.productName}`,
        `${t.amount}: ${order.amount}`,
        `${t.user}: ${order.username || t.guest} (${order.email || t.noEmail})`,
        `${t.tradeNo}: ${order.tradeNo || 'N/A'}`
    ].join('\n')

    const [telegramResult, barkResult] = await Promise.allSettled([
        sendTelegramMessage(telegramText),
        sendBarkMessage(t.paymentTitle, barkBody, { group: 'LDC Shop' })
    ])

    const success =
        (telegramResult.status === 'fulfilled' && telegramResult.value.success) ||
        (barkResult.status === 'fulfilled' && barkResult.value.success)

    return { success }
}

export async function notifyAdminRefundRequest(order: {
    orderId: string,
    productName: string,
    amount: string,
    username?: string | null,
    reason?: string | null
}) {
    const { language } = await getNotificationSettings()
    const t = messages[language as keyof typeof messages] || messages.zh

    const telegramText = `
<b>${t.refundTitle}</b>

<b>${t.order}:</b> <code>${order.orderId}</code>
<b>${t.product}:</b> ${order.productName}
<b>${t.amount}:</b> ${order.amount}
<b>${t.user}:</b> ${order.username || t.guest}
<b>${t.reason}:</b> ${order.reason || t.noReason}

<a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/refunds">${t.manageRefunds}</a>
`.trim()

    const refundsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/refunds`
    const barkBody = [
        `${t.order}: ${order.orderId}`,
        `${t.product}: ${order.productName}`,
        `${t.amount}: ${order.amount}`,
        `${t.user}: ${order.username || t.guest}`,
        `${t.reason}: ${order.reason || t.noReason}`,
        `${t.manageRefunds}: ${refundsUrl}`
    ].join('\n')

    const [telegramResult, barkResult] = await Promise.allSettled([
        sendTelegramMessage(telegramText),
        sendBarkMessage(t.refundTitle, barkBody, { group: 'LDC Shop', url: refundsUrl })
    ])

    const success =
        (telegramResult.status === 'fulfilled' && telegramResult.value.success) ||
        (barkResult.status === 'fulfilled' && barkResult.value.success)

    return { success }
}
