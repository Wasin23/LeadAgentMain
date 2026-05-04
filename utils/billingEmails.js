import { sendSystemEmail } from '../tools/emailMailgun.js';

const APP_URL = process.env.FRONTEND_URL || 'https://app.meridianai.co';

// Shared dark-themed shell — same accent bar and logo as the batch email
function emailShell({ badge, badgeColor, title, subtitle, body, ctaHref, ctaLabel, footerNote }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">

  <tr><td style="background:linear-gradient(90deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);height:3px;font-size:0;">&nbsp;</td></tr>

  <tr><td style="padding:32px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><table cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center;vertical-align:middle;line-height:36px;">
          <span style="color:#fff;font-weight:800;font-size:18px;">M</span>
        </td>
        <td style="padding-left:10px;vertical-align:middle;">
          <span style="color:#71717a;font-size:13px;font-weight:600;letter-spacing:0.06em;">MERIDIAN</span>
        </td>
      </tr></table></td>
      <td align="right">
        <span style="background:${badgeColor}22;color:${badgeColor};font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid ${badgeColor}44;">${badge}</span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 40px 28px;">
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#fafafa;line-height:1.2;">${title}</h1>
    <p style="margin:0;color:#71717a;font-size:15px;">${subtitle}</p>
  </td></tr>

  ${body}

  <tr><td style="padding:4px 40px 32px;">
    <a href="${ctaHref}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;">${ctaLabel} &rarr;</a>
  </td></tr>

  <tr><td style="padding:20px 40px;border-top:1px solid #27272a;">
    <p style="margin:0;color:#52525b;font-size:12px;line-height:1.7;">
      ${footerNote}<br>
      <a href="${APP_URL}/settings?tab=notifications" style="color:#6366f1;text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

function statsRow(cells) {
  const cols = cells.map((c, i) => `
    <td width="${Math.floor(100 / cells.length)}%" style="padding:20px;${i < cells.length - 1 ? 'border-right:1px solid #27272a;' : ''}text-align:center;">
      <div style="font-size:${c.big ? '26px' : '16px'};font-weight:700;color:${c.color};">${c.value}</div>
      <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">${c.label}</div>
    </td>`).join('');
  return `<tr><td style="padding:0 40px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:12px;border-collapse:collapse;overflow:hidden;">
      <tr>${cols}</tr>
    </table>
  </td></tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTeamMemberJoinedEmail(ownerEmail, { memberUsername, memberEmail, teamName, memberCount }) {
  const subject = `👥 ${memberUsername} joined your team`;
  const html = emailShell({
    badge: '&#x1F465; NEW MEMBER',
    badgeColor: '#6366f1',
    title: `${memberUsername} joined your team`,
    subtitle: `Your Meridian team <strong style="color:#a1a1aa;">${teamName}</strong> has a new member.`,
    body: statsRow([
      { value: memberUsername, label: 'New Member', color: '#6366f1', big: false },
      { value: memberCount, label: 'Total Members', color: '#8b5cf6', big: true },
      { value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), label: 'Date Joined', color: '#4ade80', big: false },
    ]) + `<tr><td style="padding:0 40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:10px;border-collapse:collapse;overflow:hidden;">
        <tr>
          <td style="padding:14px 16px;">
            <span style="color:#e4e4e7;font-size:13px;font-weight:500;">${memberUsername}</span>
            <span style="color:#71717a;font-size:12px;"> &middot; ${memberEmail}</span>
          </td>
          <td style="padding:14px 16px;text-align:right;">
            <span style="background:#6366f122;color:#818cf8;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid #6366f144;">member</span>
          </td>
        </tr>
      </table>
    </td></tr>`,
    ctaHref: `${APP_URL}/team`,
    ctaLabel: 'View Team',
    footerNote: 'You received this because you own a Meridian team.',
  });

  const result = await sendSystemEmail(ownerEmail, subject, html);
  if (!result.success) console.error('[TEAM EMAIL] Failed to send join notification:', result.error);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment / billing notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPaymentMethodAddedEmail(userEmail, { last4, brand }) {
  const subject = '💳 Payment method added to your account';
  const html = emailShell({
    badge: '&#x2713; CARD ADDED',
    badgeColor: '#4ade80',
    title: 'Payment method added',
    subtitle: 'Your card has been saved and your account is ready for usage-based billing.',
    body: statsRow([
      { value: brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card', label: 'Brand', color: '#6366f1', big: false },
      { value: last4 ? `••••&nbsp;${last4}` : '••••', label: 'Last 4', color: '#8b5cf6', big: false },
      { value: '&#x2713; Active', label: 'Status', color: '#4ade80', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View Billing',
    footerNote: 'You received this because a payment method was added to your Meridian account.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment method added email:', result.error);
  return result;
}

export async function sendPaymentSuccessEmail(userId, userEmail, amount) {
  const subject = '✅ Payment successful';
  const html = emailShell({
    badge: '&#x2713; PAYMENT RECEIVED',
    badgeColor: '#4ade80',
    title: `$${amount.toFixed(2)} payment received`,
    subtitle: 'Your Meridian account has been charged for API usage.',
    body: statsRow([
      { value: `$${amount.toFixed(2)}`, label: 'Amount', color: '#4ade80', big: true },
      { value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), label: 'Date', color: '#6366f1', big: false },
      { value: '&#x2713; Paid', label: 'Status', color: '#4ade80', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View Billing History',
    footerNote: 'You received this because a payment was processed on your Meridian account.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment success email:', result.error);
  return result;
}

export async function sendCreditPurchaseEmail(userEmail, { amount, credits, newBalance }) {
  const subject = `✅ ${credits.toLocaleString()} credits added`;
  const html = emailShell({
    badge: '&#x2713; CREDITS ADDED',
    badgeColor: '#4ade80',
    title: `${credits.toLocaleString()} credits purchased`,
    subtitle: amount > 0
      ? `Your card was charged <strong style="color:#a1a1aa;">$${amount.toFixed(2)}</strong> and credits have been added to your balance.`
      : 'Credits have been added to your balance.',
    body: statsRow([
      { value: `+${credits.toLocaleString()}`, label: 'Added', color: '#4ade80', big: true },
      { value: newBalance.toLocaleString(), label: 'New Balance', color: '#6366f1', big: true },
      ...(amount > 0 ? [{ value: `$${amount.toFixed(2)}`, label: 'Charged', color: '#8b5cf6', big: false }] : []),
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View Billing',
    footerNote: 'You received this because credits were purchased on your Meridian account.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send credit purchase email:', result.error);
  return result;
}

export async function sendPaymentFailedEmail(userId, userEmail, amount, errorMessage) {
  const subject = '⚠️ Payment failed — action required';
  const html = emailShell({
    badge: '&#x26A0; PAYMENT FAILED',
    badgeColor: '#f87171',
    title: `$${amount.toFixed(2)} payment failed`,
    subtitle: 'We were unable to process your monthly payment. Please update your card to avoid suspension.',
    body: `<tr><td style="padding:0 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:12px;border-collapse:collapse;overflow:hidden;">
        <tr>
          <td style="padding:20px;border-right:1px solid #27272a;text-align:center;">
            <div style="font-size:26px;font-weight:700;color:#f87171;">$${amount.toFixed(2)}</div>
            <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Amount Due</div>
          </td>
          <td style="padding:20px;text-align:center;">
            <div style="font-size:13px;font-weight:600;color:#f87171;">7 days</div>
            <div style="color:#71717a;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em;">Grace Period</div>
          </td>
        </tr>
        <tr><td colspan="2" style="padding:14px 20px;border-top:1px solid #27272a;">
          <span style="color:#71717a;font-size:12px;">Error: </span>
          <span style="color:#f87171;font-size:12px;">${errorMessage}</span>
        </td></tr>
      </table>
    </td></tr>`,
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Update Payment Method',
    footerNote: 'You received this because a payment failed on your Meridian account.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment failed email:', result.error);
  return result;
}

export async function sendAccountSuspendedEmail(userId, userEmail, amount) {
  const subject = '🚫 Account suspended — immediate action required';
  const html = emailShell({
    badge: '&#x1F6AB; SUSPENDED',
    badgeColor: '#f87171',
    title: 'Your account has been suspended',
    subtitle: `An unpaid balance of <strong style="color:#a1a1aa;">$${amount.toFixed(2)}</strong> has caused your account to be suspended. All agents have been paused.`,
    body: statsRow([
      { value: `$${amount.toFixed(2)}`, label: 'Unpaid Balance', color: '#f87171', big: true },
      { value: 'Suspended', label: 'Status', color: '#f87171', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Restore Account',
    footerNote: 'You received this because your Meridian account was suspended due to a failed payment.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send account suspended email:', result.error);
  return result;
}

export async function sendAccountReactivatedEmail(userId, userEmail) {
  const subject = '✅ Account reactivated';
  const html = emailShell({
    badge: '&#x2713; REACTIVATED',
    badgeColor: '#4ade80',
    title: 'Your account is back online',
    subtitle: 'Payment received — all your agents and services have been restored.',
    body: statsRow([
      { value: '&#x2713; Active', label: 'Status', color: '#4ade80', big: false },
      { value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), label: 'Restored', color: '#6366f1', big: false },
    ]),
    ctaHref: APP_URL,
    ctaLabel: 'Go to Dashboard',
    footerNote: 'You received this because your Meridian account was reactivated.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send reactivated email:', result.error);
  return result;
}

export async function sendGracePeriodWarningEmail(userId, userEmail, daysRemaining, amount) {
  const suspensionDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = `⚠️ Account suspends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  const html = emailShell({
    badge: '&#x26A0; ACTION REQUIRED',
    badgeColor: '#fbbf24',
    title: `Suspension in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
    subtitle: 'Update your payment method now to keep your agents running.',
    body: statsRow([
      { value: `$${amount.toFixed(2)}`, label: 'Unpaid', color: '#fbbf24', big: true },
      { value: daysRemaining, label: 'Days Left', color: '#f87171', big: true },
      { value: suspensionDate, label: 'Suspends', color: '#71717a', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Update Payment Method',
    footerNote: 'You received this because your Meridian account has an outstanding balance.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send grace period warning:', result.error);
  return result;
}

export async function sendPlanCancelledEmail(userId, userEmail, fromPlanName) {
  const subject = 'Your Meridian plan has been cancelled';
  const html = emailShell({
    badge: 'PLAN CANCELLED',
    badgeColor: '#71717a',
    title: `${fromPlanName} cancelled`,
    subtitle: 'Your subscription has ended and your account has moved to the Free tier.',
    body: statsRow([
      { value: 'Free Tier', label: 'New Plan', color: '#71717a', big: false },
      { value: '1 Agent', label: 'Limit', color: '#71717a', big: false },
      { value: '$0', label: 'Monthly', color: '#4ade80', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Manage Billing',
    footerNote: 'You can re-subscribe at any time from your billing settings.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan cancelled email:', result.error);
  return result;
}

export async function sendPlanChangedEmail(userId, userEmail, fromPlanName, toPlanName) {
  const subject = `Your Meridian plan has been updated to ${toPlanName}`;
  const html = emailShell({
    badge: 'PLAN UPDATED',
    badgeColor: '#6366f1',
    title: `Moved to ${toPlanName}`,
    subtitle: `Your plan changed from <strong style="color:#a1a1aa;">${fromPlanName}</strong> to <strong style="color:#a1a1aa;">${toPlanName}</strong>. New limits are active immediately.`,
    body: statsRow([
      { value: fromPlanName, label: 'Previous', color: '#71717a', big: false },
      { value: toPlanName, label: 'New Plan', color: '#6366f1', big: false },
    ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View Billing',
    footerNote: 'You received this because your Meridian plan was updated.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan changed email:', result.error);
  return result;
}

export async function sendPlanUpgradedEmail(userId, userEmail, fromPlanName, toPlanName, amountCharged) {
  const subject = `✅ Welcome to ${toPlanName}`;
  const html = emailShell({
    badge: '&#x2B06; UPGRADED',
    badgeColor: '#4ade80',
    title: `Welcome to ${toPlanName}`,
    subtitle: `Upgraded from <strong style="color:#a1a1aa;">${fromPlanName}</strong>. Your new limits and credits are live.`,
    body: statsRow([
      { value: toPlanName, label: 'New Plan', color: '#6366f1', big: false },
      { value: `$${amountCharged.toFixed(2)}`, label: 'Charged', color: '#4ade80', big: true },
      { value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), label: 'Date', color: '#71717a', big: false },
    ]),
    ctaHref: APP_URL,
    ctaLabel: 'Go to Dashboard',
    footerNote: 'You received this because your Meridian plan was upgraded.',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan upgraded email:', result.error);
  return result;
}
