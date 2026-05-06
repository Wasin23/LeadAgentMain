import { NextRequest, NextResponse } from 'next/server'
import FormData from 'form-data'
import Mailgun from 'mailgun.js'

const mailgun = new Mailgun(FormData)
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY!,
})

const DOMAIN = process.env.MAILGUN_DOMAIN!
const TO     = process.env.CONTACT_TO_EMAIL ?? 'colton.fidd@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await mg.messages.create(DOMAIN, {
      from:    `Meridian Contact <mailgun@${DOMAIN}>`,
      to:      [TO],
      subject: `Enterprise inquiry from ${name}${company ? ` · ${company}` : ''}`,
      text: `Name:    ${name}
Email:   ${email}
Company: ${company || '—'}

${message}`,
      html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;border-radius:8px;padding:32px">
  <h2 style="margin:0 0 20px;font-size:20px;color:#111">Enterprise inquiry</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666;width:80px">Name</td><td style="padding:6px 0;color:#111;font-weight:600">${name}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${email}" style="color:#4f46e5">${email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#666">Company</td><td style="padding:6px 0;color:#111">${company || '—'}</td></tr>
  </table>
  <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;margin:0">${message}</p>
  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Sent via Meridian landing page</p>
</div>`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] Mailgun error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
