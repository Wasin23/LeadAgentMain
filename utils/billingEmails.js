import { sendSystemEmail } from '../tools/emailMailgun.js';

const APP_URL = process.env.FRONTEND_URL || 'https://app.meridianai.co';

function emailShell({ title, body, ctaHref, ctaLabel, footerNote }) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ede8de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 20px;">
<table width="560" cellpadding="0" cellspacing="0">

  <!-- logo -->
  <tr><td style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <img src="${APP_URL}/MeridianM.png" width="32" height="32" alt="M" style="display:block;" />
      </td>
      <td style="padding-left:9px;vertical-align:middle;">
        <span style="color:#6b6455;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Meridian</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- accent bar -->
  <tr><td style="background:#1a3d28;height:2px;border-radius:2px 2px 0 0;font-size:0;">&nbsp;</td></tr>

  <!-- card -->
  <tr><td style="background:#f4efe6;border-radius:0 0 12px 12px;border:1px solid rgba(26,26,24,0.12);border-top:none;padding:36px 40px;">

    <h2 style="margin:0 0 16px;font-size:20px;font-weight:400;color:#1a1a18;line-height:1.3;font-family:Georgia,serif;">${title}</h2>

    ${body}

    ${ctaHref ? `<table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr>
      <td style="background:#1a3d28;border-radius:4px;">
        <a href="${ctaHref}" style="display:inline-block;color:#f4efe6;text-decoration:none;font-size:13px;font-weight:500;padding:11px 24px;letter-spacing:0.05em;">${ctaLabel}</a>
      </td>
    </tr></table>` : ''}

  </td></tr>

  <!-- footer -->
  <tr><td style="padding:24px 4px 0;">
    <p style="margin:0;color:#9e8252;font-size:12px;line-height:1.8;">
      ${footerNote} &middot; <a href="${APP_URL}/settings?tab=notifications" style="color:#1a3d28;text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function p(text) {
  return `<p style="margin:0 0 14px;color:#6b6455;font-size:14px;line-height:1.7;">${text}</p>`;
}

function detail(label, value) {
  return `<tr>
    <td style="padding:10px 0;color:#9e8252;font-size:13px;border-bottom:1px solid rgba(26,26,24,0.1);">${label}</td>
    <td style="padding:10px 0;color:#1a1a18;font-size:13px;text-align:right;border-bottom:1px solid rgba(26,26,24,0.1);">${value}</td>
  </tr>`;
}

function detailTable(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">${rows.join('')}</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Team notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTeamMemberJoinedEmail(ownerEmail, { memberUsername, memberEmail, teamName, memberCount }) {
  const subject = `${memberUsername} joined your team`;
  const html = emailShell({
    title: 'New team member',
    body: p(`<strong style="color:#1a1a18;">${memberUsername}</strong> just joined <strong style="color:#1a1a18;">${teamName}</strong> using your invite link.`) +
      detailTable([
        detail('Member', memberUsername),
        detail('Email', memberEmail),
        detail('Team size', `${memberCount} member${memberCount !== 1 ? 's' : ''}`),
        detail('Joined', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })),
      ]),
    ctaHref: `${APP_URL}/team`,
    ctaLabel: 'View team',
    footerNote: 'You received this because you own a Meridian team',
  });

  const result = await sendSystemEmail(ownerEmail, subject, html);
  if (!result.success) console.error('[TEAM EMAIL] Failed to send join notification:', result.error);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment / billing notifications
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPaymentMethodAddedEmail(userEmail, { last4, brand }) {
  const subject = 'Payment method added';
  const brandName = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
  const html = emailShell({
    title: 'Payment method saved',
    body: p(`Your ${brandName} ending in <strong style="color:#1a1a18;">${last4 || '••••'}</strong> has been added to your account.`) +
      p(`Usage-based billing is now active. You'll be charged at the end of each billing cycle for any API usage.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View billing settings',
    footerNote: 'You received this because a payment method was added to your Meridian account',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment method added email:', result.error);
  return result;
}

export async function sendPaymentSuccessEmail(userId, userEmail, amount) {
  const subject = 'Payment received';
  const html = emailShell({
    title: 'Payment processed',
    body: p(`Your monthly payment of <strong style="color:#1a1a18;">$${amount.toFixed(2)}</strong> has been processed successfully.`) +
      detailTable([
        detail('Amount', `$${amount.toFixed(2)}`),
        detail('Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })),
        detail('Status', 'Paid'),
      ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View billing history',
    footerNote: 'You received this because a payment was processed on your Meridian account',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment success email:', result.error);
  return result;
}

export async function sendCreditPurchaseEmail(userEmail, { amount, credits, newBalance }) {
  const subject = `${credits.toLocaleString()} credits added`;
  const html = emailShell({
    title: 'Credits added to your account',
    body: p(`<strong style="color:#1a1a18;">${credits.toLocaleString()} credits</strong> have been added to your balance.`) +
      detailTable([
        detail('Credits added', `+${credits.toLocaleString()}`),
        detail('New balance', newBalance.toLocaleString()),
        ...(amount > 0 ? [detail('Amount charged', `$${amount.toFixed(2)}`)] : []),
        detail('Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })),
      ]),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View billing',
    footerNote: 'You received this because credits were purchased on your Meridian account',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send credit purchase email:', result.error);
  return result;
}

export async function sendPaymentFailedEmail(userId, userEmail, amount, errorMessage) {
  const subject = 'Payment failed';
  const html = emailShell({
    title: 'We couldn\'t process your payment',
    body: p(`Your monthly payment of <strong style="color:#1a1a18;">$${amount.toFixed(2)}</strong> didn't go through. Please update your payment method to keep your account active.`) +
      detailTable([
        detail('Amount', `$${amount.toFixed(2)}`),
        detail('Reason', errorMessage),
        detail('Grace period', '7 days'),
      ]) +
      p(`If you don't update your payment method within 7 days, your account will be paused.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Update payment method',
    footerNote: 'You received this because a payment failed on your Meridian account',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send payment failed email:', result.error);
  return result;
}

export async function sendGracePeriodWarningEmail(userId, userEmail, daysRemaining, amount) {
  const suspensionDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const subject = `Account pauses in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  const html = emailShell({
    title: 'Action needed on your account',
    body: p(`You have an unpaid balance of <strong style="color:#1a1a18;">$${amount.toFixed(2)}</strong>. Your account will be paused on <strong style="color:#1a1a18;">${suspensionDate}</strong> if payment isn't received.`) +
      p(`Update your payment method to keep your agents running without interruption.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Update payment method',
    footerNote: 'You received this because your Meridian account has an outstanding balance',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send grace period warning:', result.error);
  return result;
}

export async function sendAccountSuspendedEmail(userId, userEmail, amount) {
  const subject = 'Your account has been paused';
  const html = emailShell({
    title: 'Account paused',
    body: p(`Your account has been paused due to an unpaid balance of <strong style="color:#1a1a18;">$${amount.toFixed(2)}</strong>. Your agents have been stopped.`) +
      p(`Add a payment method or update your existing card to restore access immediately.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Restore account',
    footerNote: 'You received this because your Meridian account was paused due to a failed payment',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send account suspended email:', result.error);
  return result;
}

export async function sendAccountReactivatedEmail(userId, userEmail) {
  const subject = 'Account reactivated';
  const html = emailShell({
    title: 'You\'re all set',
    body: p(`Your account is active again. All your agents and services have been restored.`),
    ctaHref: APP_URL,
    ctaLabel: 'Go to dashboard',
    footerNote: 'You received this because your Meridian account was reactivated',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send reactivated email:', result.error);
  return result;
}

export async function sendPlanCancelledEmail(userId, userEmail, fromPlanName) {
  const subject = 'Subscription cancelled';
  const html = emailShell({
    title: 'Your subscription has ended',
    body: p(`Your <strong style="color:#1a1a18;">${fromPlanName}</strong> subscription has been cancelled and your account has moved to the free tier.`) +
      detailTable([
        detail('Previous plan', fromPlanName),
        detail('Current plan', 'Free'),
        detail('Agent limit', '1'),
        detail('Monthly charges', 'None'),
      ]) +
      p(`You can resubscribe at any time from your billing settings.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'Manage billing',
    footerNote: 'You received this because your Meridian subscription was cancelled',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan cancelled email:', result.error);
  return result;
}

export async function sendPlanChangedEmail(userId, userEmail, fromPlanName, toPlanName) {
  const subject = 'Plan updated';
  const html = emailShell({
    title: 'Your plan has been updated',
    body: p(`Your Meridian plan has changed from <strong style="color:#1a1a18;">${fromPlanName}</strong> to <strong style="color:#1a1a18;">${toPlanName}</strong>. Your new limits are active immediately.`),
    ctaHref: `${APP_URL}/settings?tab=billing`,
    ctaLabel: 'View billing',
    footerNote: 'You received this because your Meridian plan was updated',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan changed email:', result.error);
  return result;
}

export async function sendPlanUpgradedEmail(userId, userEmail, fromPlanName, toPlanName, amountCharged) {
  const subject = `Welcome to ${toPlanName}`;
  const html = emailShell({
    title: `You're on ${toPlanName}`,
    body: p(`Your plan has been upgraded from <strong style="color:#1a1a18;">${fromPlanName}</strong> to <strong style="color:#1a1a18;">${toPlanName}</strong>. Your new credits and agent limits are live.`) +
      detailTable([
        detail('New plan', toPlanName),
        detail('Amount charged', `$${amountCharged.toFixed(2)}`),
        detail('Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })),
      ]),
    ctaHref: APP_URL,
    ctaLabel: 'Go to dashboard',
    footerNote: 'You received this because your Meridian plan was upgraded',
  });

  const result = await sendSystemEmail(userEmail, subject, html);
  if (!result.success) console.error('[BILLING EMAIL] Failed to send plan upgraded email:', result.error);
  return result;
}
