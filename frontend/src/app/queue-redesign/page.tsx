'use client';

import { useState } from 'react';

export default function QueueRedesignPage() {
  const [stats] = useState({
    emailsQueued: 12,
    totalEmailsQueued: 156,
    emailsSent: 42,
    totalEmailsSent: 420,
    emailsReplied: 3
  });

  const handleQueueClick = (type: string, name: string) => {
    console.log(`Clicked ${name} (${type})`);
  };

  // Color calculation helper
  const getColorForLevel = (level: number) => {
    const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
    return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
  };

  const calculateProgress = (totalCount: number) => {
    let level = 0;
    let count = totalCount;
    let milestone = 50;
    while (count >= milestone) {
      count -= milestone;
      level++;
      milestone = 50 + (level * 20);
    }
    const currentMilestone = 50 + (level * 20);
    return {
      level,
      count,
      currentMilestone,
      progress: count / currentMilestone,
      color: getColorForLevel(level)
    };
  };

  const queueProgress = calculateProgress(stats.totalEmailsQueued);
  const sentProgress = calculateProgress(stats.totalEmailsSent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Queue Display Redesign</h1>
          <p className="text-[#8FA6C1]">Comparison of different design options for the stats panel</p>
        </div>

        {/* Current Design */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Current Design (180x180px)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-4 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
              <button className="relative w-[180px] h-[180px] hover:scale-105 transition-all duration-200 cursor-pointer active:scale-95 flex flex-col items-center justify-center group mx-auto">
                <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                  <defs>
                    <radialGradient id="innerGlow-current" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" style={{ stopColor: 'rgba(79, 209, 255, 0.35)', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: 'rgba(79, 209, 255, 0)', stopOpacity: 1 }} />
                    </radialGradient>
                  </defs>
                  <circle cx="50%" cy="50%" r="45%" fill="url(#innerGlow-current)" />
                  <circle cx="50%" cy="50%" r="80" fill="none" stroke="rgba(79, 209, 255, 0.3)" strokeWidth="3" />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="80"
                    fill="none"
                    stroke={queueProgress.color}
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 80}`}
                    strokeDashoffset={2 * Math.PI * 80 * (1 - queueProgress.progress)}
                    className="transition-all duration-500"
                    style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
                  />
                </svg>
                <div className="relative z-10 text-center">
                  <div className="text-[#A3B4CC] text-xs mb-1.5">Email Queue</div>
                  <div className="text-5xl font-bold text-white mb-1">{stats.emailsQueued}</div>
                  <div className="text-[#8FA6C1] text-[9px] font-medium">
                    Milestone: {queueProgress.count}/{queueProgress.currentMilestone}
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div className="mt-4 text-[#8FA6C1] text-sm">
            ❌ 32,400px² per item • Takes significant vertical space
          </div>
        </div>

        {/* Option 1: Horizontal Bar */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Option 1: Horizontal Compact Bar (Recommended)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email Queue */}
            <div className="p-3 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
              <button onClick={() => handleQueueClick('queued', 'Email Queue')} className="w-full hover:scale-[1.02] transition-all cursor-pointer active:scale-[0.98]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#4FD1FF]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-[#A3B4CC] text-[10px] font-medium">Email Queue</div>
                      <div className="text-white text-xl font-bold">{stats.emailsQueued}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="text-[#8FA6C1] text-[9px]">{queueProgress.count}/{queueProgress.currentMilestone}</div>
                    <div className="text-[#8FA6C1] text-[8px]">Milestone</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-[#0F1E35] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${queueProgress.progress * 100}%`, backgroundColor: queueProgress.color, boxShadow: '0 0 8px currentColor' }} />
                </div>
              </button>
            </div>

            {/* Emails Sent */}
            <div className="p-3 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
              <button onClick={() => handleQueueClick('sent', 'Emails Sent')} className="w-full hover:scale-[1.02] transition-all cursor-pointer active:scale-[0.98]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-[#A3B4CC] text-[10px] font-medium">Emails Sent</div>
                      <div className="text-white text-xl font-bold">{stats.emailsSent}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="text-[#8FA6C1] text-[9px]">{sentProgress.count}/{sentProgress.currentMilestone}</div>
                    <div className="text-[#8FA6C1] text-[8px]">Milestone</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-[#0F1E35] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${sentProgress.progress * 100}%`, backgroundColor: sentProgress.color, boxShadow: '0 0 8px currentColor' }} />
                </div>
              </button>
            </div>
          </div>
          <div className="mt-4 text-green-400 text-sm">
            ✅ 14,400px² (75% savings) • Retains all info • Clean & efficient
          </div>
        </div>

        {/* Option 2: Mini Ring */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Option 2: Compact Card with Mini Ring</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-3 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
              <button onClick={() => handleQueueClick('queued', 'Email Queue')} className="w-full hover:scale-[1.02] transition-all cursor-pointer active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 flex-shrink-0">
                    <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50%" cy="50%" r="22" fill="none" stroke="rgba(79, 209, 255, 0.2)" strokeWidth="2"/>
                      <circle cx="50%" cy="50%" r="22" fill="none" stroke={queueProgress.color} strokeWidth="3" strokeDasharray={`${2 * Math.PI * 22}`} strokeDashoffset={2 * Math.PI * 22 * (1 - queueProgress.progress)} className="transition-all duration-500" style={{ filter: 'drop-shadow(0 0 4px currentColor)' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-lg font-bold">{stats.emailsQueued}</div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#A3B4CC] text-xs mb-1">Email Queue</div>
                    <div className="text-[#8FA6C1] text-[9px]">Milestone: {queueProgress.count}/{queueProgress.currentMilestone}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div className="mt-4 text-[#8FA6C1] text-sm">
            ⚡ 19,200px² (60% savings) • Keeps ring aesthetic
          </div>
        </div>

        {/* Option 3: Minimal List */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Option 3: Minimal List Item</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <button onClick={() => handleQueueClick('queued', 'Email Queue')} className="w-full p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:bg-[#1B2F52]/80 hover:border-[#4FD1FF]/40 transition-all cursor-pointer active:scale-[0.98] group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#4FD1FF]/20 flex items-center justify-center group-hover:bg-[#4FD1FF]/30 transition-colors">
                    <svg className="w-3.5 h-3.5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-[#A3B4CC] text-[10px] font-medium">Email Queue</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-white text-2xl font-bold">{stats.emailsQueued}</div>
                  <div className="w-2 rounded-full transition-all duration-500" style={{ backgroundColor: queueProgress.color, boxShadow: '0 0 12px currentColor', height: `${Math.max(8, queueProgress.progress * 32)}px` }} />
                </div>
              </div>
            </button>
          </div>
          <div className="mt-4 text-green-400 text-sm">
            ✅ 11,520px² (80% savings) • Most compact
          </div>
        </div>

        {/* Option 4: Side-by-Side */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Option 4: Side-by-Side Mini Cards</h2>
          <div className="grid grid-cols-3 gap-2 max-w-3xl">
            <button onClick={() => handleQueueClick('queued', 'Email Queue')} className="p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:scale-105 transition-all cursor-pointer active:scale-95 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-[#4FD1FF]/10 group-hover:bg-[#4FD1FF]/20 flex items-center justify-center mb-2 transition-colors">
                  <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-white text-2xl font-bold mb-0.5">{stats.emailsQueued}</div>
                <div className="text-[#A3B4CC] text-[9px] font-medium mb-1">Queue</div>
                <div className="w-full h-1 bg-[#0F1E35] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500" style={{ width: `${queueProgress.progress * 100}%`, backgroundColor: queueProgress.color }} />
                </div>
              </div>
            </button>
            <button onClick={() => handleQueueClick('sent', 'Sent')} className="p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:scale-105 transition-all cursor-pointer active:scale-95 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center mb-2 transition-colors">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-white text-2xl font-bold mb-0.5">{stats.emailsSent}</div>
                <div className="text-[#A3B4CC] text-[9px] font-medium mb-1">Sent</div>
                <div className="w-full h-1 bg-[#0F1E35] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500" style={{ width: `${sentProgress.progress * 100}%`, backgroundColor: sentProgress.color }} />
                </div>
              </div>
            </button>
            <button onClick={() => handleQueueClick('replied', 'Responses')} className="p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:scale-105 transition-all cursor-pointer active:scale-95 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center mb-2 transition-colors">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <div className="text-white text-2xl font-bold mb-0.5">{stats.emailsReplied}</div>
                <div className="text-[#A3B4CC] text-[9px] font-medium mb-1">Replied</div>
                <div className="w-full h-1 bg-[#0F1E35] rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500 bg-purple-500" style={{ width: '45%' }} />
                </div>
              </div>
            </button>
          </div>
          <div className="mt-4 text-[#8FA6C1] text-sm">
            ⚡ 8,000px² per item (70% savings) • Fits all 3 together horizontally
          </div>
        </div>

        {/* Option 5: Dashboard Tiles */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Option 5: Dashboard Tiles (Modern)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <button onClick={() => handleQueueClick('queued', 'Email Queue')} className="relative w-full p-4 bg-gradient-to-br from-[#1B2F52]/60 to-[#0F1E35]/80 rounded-xl border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all cursor-pointer active:scale-[0.98] overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#4FD1FF]/0 to-[#4FD1FF]/10 opacity-0 group-hover:opacity-100 transition-opacity"/>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#4FD1FF]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-[#A3B4CC] text-xs font-medium">Email Queue</div>
                  </div>
                  <div className="px-2 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: queueProgress.color + '40', color: queueProgress.color }}>
                    LVL {queueProgress.level}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-white text-3xl font-bold">{stats.emailsQueued}</div>
                  <div className="text-right">
                    <div className="text-[#8FA6C1] text-[9px] leading-tight">{queueProgress.count}/{queueProgress.currentMilestone}</div>
                    <div className="text-[#8FA6C1] text-[8px]">milestone</div>
                  </div>
                </div>
              </div>
            </button>
          </div>
          <div className="mt-4 text-[#8FA6C1] text-sm">
            ⚡ 21,600px² (65% savings) • Modern gradient design with level badges
          </div>
        </div>
      </div>
    </div>
  );
}
