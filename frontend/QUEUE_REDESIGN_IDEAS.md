# Queue Display Redesign Ideas

## Current Issue
The circular progress rings take up 180x180px each (32,400px² per item), stacking vertically and consuming significant screen space.

---

## Option 1: Horizontal Compact Bar (Recommended)
**Space savings: ~75%**

```tsx
{/* Horizontal Bar Design - 240px wide x 60px tall */}
<div className="p-3 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
  <button
    onClick={() => handleQueueClick('queued', 'Email Queue')}
    className="w-full hover:scale-[1.02] transition-all cursor-pointer active:scale-[0.98]"
  >
    <div className="flex items-center justify-between gap-3">
      {/* Left: Icon + Label */}
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
      
      {/* Right: Progress Info */}
      <div className="flex flex-col items-end flex-shrink-0">
        <div className="text-[#8FA6C1] text-[9px]">
          {(() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) {
              count -= milestone;
              level++;
              milestone = 50 + (level * 20);
            }
            const currentMilestone = 50 + (level * 20);
            return `${count}/${currentMilestone}`;
          })()}
        </div>
        <div className="text-[#8FA6C1] text-[8px]">Milestone</div>
      </div>
    </div>
    
    {/* Progress Bar */}
    <div className="mt-2 h-1.5 bg-[#0F1E35] rounded-full overflow-hidden">
      <div 
        className="h-full transition-all duration-500 rounded-full"
        style={{
          width: `${(() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) {
              count -= milestone;
              level++;
              milestone = 50 + (level * 20);
            }
            const currentMilestone = 50 + (level * 20);
            return (count / currentMilestone) * 100;
          })()}%`,
          backgroundColor: (() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) {
              count -= milestone;
              level++;
              milestone = 50 + (level * 20);
            }
            const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
            return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
          })(),
          boxShadow: '0 0 8px currentColor'
        }}
      />
    </div>
  </button>
</div>
```

---

## Option 2: Compact Card with Mini Ring
**Space savings: ~60%**

```tsx
{/* Compact Card - 240px wide x 80px tall */}
<div className="p-3 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
  <button
    onClick={() => handleQueueClick('queued', 'Email Queue')}
    className="w-full hover:scale-[1.02] transition-all cursor-pointer active:scale-[0.98]"
  >
    <div className="flex items-center gap-3">
      {/* Mini Ring */}
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50%" cy="50%" r="22" fill="none" stroke="rgba(79, 209, 255, 0.2)" strokeWidth="2"/>
          <circle
            cx="50%"
            cy="50%"
            r="22"
            fill="none"
            stroke={(() => {
              let level = 0;
              let count = stats.totalEmailsQueued || stats.emailsQueued;
              let milestone = 50;
              while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
              const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
              return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
            })()}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={(() => {
              let level = 0;
              let count = stats.totalEmailsQueued || stats.emailsQueued;
              let milestone = 50;
              while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
              const currentMilestone = 50 + (level * 20);
              const progress = count / currentMilestone;
              return 2 * Math.PI * 22 * (1 - progress);
            })()}
            className="transition-all duration-500"
            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-lg font-bold">{stats.emailsQueued}</div>
        </div>
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[#A3B4CC] text-xs mb-1">Email Queue</div>
        <div className="text-[#8FA6C1] text-[9px]">
          Milestone: {(() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const currentMilestone = 50 + (level * 20);
            return `${count}/${currentMilestone}`;
          })()}
        </div>
      </div>
    </div>
  </button>
</div>
```

---

## Option 3: Minimal List Item
**Space savings: ~80%**

```tsx
{/* Minimal List - 240px wide x 48px tall */}
<button
  onClick={() => handleQueueClick('queued', 'Email Queue')}
  className="w-full p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:bg-[#1B2F52]/80 hover:border-[#4FD1FF]/40 transition-all cursor-pointer active:scale-[0.98] group"
>
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
      {/* Count */}
      <div className="text-white text-2xl font-bold">{stats.emailsQueued}</div>
      
      {/* Color Level Indicator */}
      <div 
        className="w-2 h-8 rounded-full transition-all duration-500"
        style={{
          backgroundColor: (() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
            return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
          })(),
          boxShadow: '0 0 12px currentColor',
          height: `${(() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const currentMilestone = 50 + (level * 20);
            return Math.max(8, (count / currentMilestone) * 32);
          })()}px`
        }}
      />
    </div>
  </div>
</button>
```

---

## Option 4: Side-by-Side Mini Cards
**Space savings: ~70%**

```tsx
{/* Container for all 3 queues side-by-side */}
<div className="grid grid-cols-3 gap-2">
  {/* Email Queue */}
  <button
    onClick={() => handleQueueClick('queued', 'Email Queue')}
    className="p-2.5 bg-[#1B2F52]/60 rounded-lg border border-[#4FD1FF]/20 hover:scale-105 transition-all cursor-pointer active:scale-95 group"
  >
    <div className="flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-lg bg-[#4FD1FF]/10 group-hover:bg-[#4FD1FF]/20 flex items-center justify-center mb-2 transition-colors">
        <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="text-white text-2xl font-bold mb-0.5">{stats.emailsQueued}</div>
      <div className="text-[#A3B4CC] text-[9px] font-medium mb-1">Queue</div>
      {/* Mini progress bar */}
      <div className="w-full h-1 bg-[#0F1E35] rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-500"
          style={{
            width: `${(() => {
              let level = 0;
              let count = stats.totalEmailsQueued || stats.emailsQueued;
              let milestone = 50;
              while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
              const currentMilestone = 50 + (level * 20);
              return (count / currentMilestone) * 100;
            })()}%`,
            backgroundColor: (() => {
              let level = 0;
              let count = stats.totalEmailsQueued || stats.emailsQueued;
              let milestone = 50;
              while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
              const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
              return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
            })()
          }}
        />
      </div>
    </div>
  </button>
  
  {/* Repeat for Sent and Responses */}
</div>
```

---

## Option 5: Dashboard Tiles (Modern)
**Space savings: ~65%**

```tsx
{/* Dashboard Tile - 240px wide x 90px tall */}
<button
  onClick={() => handleQueueClick('queued', 'Email Queue')}
  className="relative w-full p-4 bg-gradient-to-br from-[#1B2F52]/60 to-[#0F1E35]/80 rounded-xl border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all cursor-pointer active:scale-[0.98] overflow-hidden group"
>
  {/* Animated background glow */}
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
      {/* Level badge */}
      <div 
        className="px-2 py-0.5 rounded text-[8px] font-bold"
        style={{
          backgroundColor: (() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
            return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
          })() + '40',
          color: (() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
            return level > 60 ? '#000000' : colors[Math.min(level, 60)];
          })()
        }}
      >
        LVL {(() => {
          let level = 0;
          let count = stats.totalEmailsQueued || stats.emailsQueued;
          let milestone = 50;
          while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
          return level;
        })()}
      </div>
    </div>
    
    <div className="flex items-end justify-between">
      <div className="text-white text-3xl font-bold">{stats.emailsQueued}</div>
      <div className="text-right">
        <div className="text-[#8FA6C1] text-[9px] leading-tight">
          {(() => {
            let level = 0;
            let count = stats.totalEmailsQueued || stats.emailsQueued;
            let milestone = 50;
            while (count >= milestone) { count -= milestone; level++; milestone = 50 + (level * 20); }
            const currentMilestone = 50 + (level * 20);
            return `${count}/${currentMilestone}`;
          })()}
        </div>
        <div className="text-[#8FA6C1] text-[8px]">milestone</div>
      </div>
    </div>
  </div>
</button>
```

---

## Comparison

| Design | Height | Area | Savings | Pros | Cons |
|--------|--------|------|---------|------|------|
| **Current Circles** | 180px | 32,400px² | - | Beautiful, detailed | Huge space usage |
| **Option 1: Horizontal Bar** | 60px | 14,400px² | 75% | Clean, efficient | Less visual impact |
| **Option 2: Mini Ring** | 80px | 19,200px² | 60% | Keeps ring aesthetic | Still large |
| **Option 3: Minimal List** | 48px | 11,520px² | 80% | Most compact | Less prominent |
| **Option 4: Side-by-Side** | 100px | 8,000px² ea | 70% | Fits all 3 together | Horizontal space |
| **Option 5: Dashboard Tile** | 90px | 21,600px² | 65% | Modern, polished | Medium savings |

---

## Recommendation: **Option 1 - Horizontal Compact Bar**

**Why:**
- 75% space savings
- Retains all information (count, milestone, progress, color level)
- Still visually appealing with glowing progress bar
- Easy to scan vertically
- Maintains the color progression system
- Click to expand still works

**Implementation:**
Replace the circular progress sections (lines 1320-1600 in dashboard/page.tsx) with the horizontal bar design.
