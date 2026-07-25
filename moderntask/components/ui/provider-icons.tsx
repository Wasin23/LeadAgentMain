export function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 193" fill="none">
      <path d="M58.182 192.05V93.768L27.507 65.158L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4"/>
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.854 17.455-17.455V49.504l-31.274 17.278-27.506 28.61Z" fill="#34A853"/>
      <path d="M197.818 49.504V93.768l58.182-44.264V34.91c0-21.585-24.641-33.89-41.89-20.945Z" fill="#FBBC04"/>
      <path d="M58.182 93.768V49.504L128 105.23l69.818-55.726v44.264L128 149.494Z" fill="#EA4335"/>
      <path d="M0 34.91v14.594l58.182 44.264V49.504L40.727 37.072C23.478 24.019-.001 36.324 0 34.91Z" fill="#C5221F"/>
    </svg>
  )
}

export function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="og1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0364B8"/><stop offset="100%" stopColor="#0078D4"/></linearGradient>
        <linearGradient id="og2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#28A8EA"/><stop offset="100%" stopColor="#0078D4"/></linearGradient>
      </defs>
      <path fill="url(#og1)" d="M16,128V16h144v112H16z"/>
      <path fill="url(#og2)" d="M160,128h96v112H160V128z"/>
      <path fill="#0078D4" d="M160,16h96v96h-96V16z"/>
      <path fill="#50D9FF" d="M16,144h144v96H16V144z"/>
      <circle fill="#FFF" cx="88" cy="88" r="40"/>
      <path fill="#0078D4" d="M88,108c-11,0-20-9-20-20s9-20,20-20s20,9,20,20S99,108,88,108z M88,76c-6.6,0-12,5.4-12,12s5.4,12,12,12s12-5.4,12-12S94.6,76,88,76z"/>
    </svg>
  )
}

export function MeridianSendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}
