// ── Data ──────────────────────────────────────

const PLATFORMS = {
  tiktok:    {id:'tiktok',    name:'TikTok',      emoji:'<i class="fa-brands fa-tiktok"></i>', limit:20},
  instagram: {id:'instagram', name:'Instagram',    emoji:'<i class="fa-brands fa-instagram"></i>', limit:30},
  youtube:   {id:'youtube',   name:'YT Shorts',    emoji:'<i class="fa-brands fa-youtube" style="color: #ff0000;"></i>', limit:15},
  twitter:   {id:'twitter',   name:'X (Twitter)',  emoji:'<i class="fa-brands fa-x-twitter"></i>', limit:25},
  facebook:  {id:'facebook',  name:'Facebook',     emoji:'<i class="fa-brands fa-facebook" style="color: #1877f2;"></i>', limit:20},
}

const ACHIEVEMENTS = [
  {id:'first_pause',  name:'Zen Mode',          emoji:'<i class="fa-solid fa-person-praying" style="color: #a78bfa;"></i>', desc:'Aceptaste tu primera pausa',          xp:50},
  {id:'streak_3',     name:'Constante',          emoji:'<i class="fa-solid fa-seedling" style="color: #4ecdc4;"></i>', desc:'3 días consecutivos bajo el límite',  xp:75},
  {id:'streak_7',     name:'En llamas',          emoji:'<i class="fa-solid fa-fire" style="color: #ff5e5e;"></i>', desc:'7 días consecutivos',                 xp:150},
  {id:'streak_30',    name:'Maestro Digital',    emoji:'<i class="fa-solid fa-trophy" style="color: #ffb347;"></i>', desc:'30 días de racha',                    xp:500},
  {id:'reduce_50',    name:'Dueño de mi tiempo', emoji:'<i class="fa-solid fa-dumbbell" style="color: #c8f135;"></i>', desc:'Redujiste tu promedio un 50%',        xp:200},
  {id:'first_day',    name:'Un buen día',        emoji:'<i class="fa-solid fa-check" style="color: #c8f135;"></i>', desc:'Primer día dentro del límite',        xp:100},
]

const LEVELS = [
  [0,'Iniciando'],[100,'Curioso'],[250,'Consciente'],[500,'Atento'],
  [800,'Equilibrado'],[1200,'Consciente Digital'],[1700,'Maestro del Tiempo'],
  [2300,'Zen Digital'],[3000,'Iluminado'],[4000,'Gurú Digital'],[5500,'Leyenda'],
]

const today = () => new Date().toISOString().slice(0,10)

async function g(key)       { const r = await chrome.storage.local.get(key); return r[key] }
async function s(key, val)  { return chrome.storage.local.set({[key]:val}) }

async function getStats()  { const a = (await g('daily'))||{}; return a[today()]||{} }
async function getConfig() {
  const saved = (await g('config'))||{}
  const def   = {}
  Object.values(PLATFORMS).forEach(p => { def[p.id] = {limit:p.limit, enabled:true} })
  return {...def,...saved}
}
async function getStreak() { return (await g('streak'))||{count:0,shieldCount:1} }
async function getXP() {
  const total = ((await g('xp'))||{total:0}).total
  const li    = [...LEVELS].reverse().findIndex(([t])=>total>=t)
  const idx   = li === -1 ? 0 : LEVELS.length - 1 - li
  const [prevT, name] = LEVELS[idx]
  const nextT = LEVELS[idx+1]?.[0] || prevT + 1000
  return {total, level:idx+1, name, progress:Math.round(((total-prevT)/(nextT-prevT))*100)}
}
async function getWeekly() {
  const all = (await g('daily'))||{}
  return Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(6-i))
    const k = d.toISOString().slice(0,10)
    const data = all[k]||{}
    return {date:k, total:Math.round(Object.values(data).reduce((a,b)=>a+b,0))}
  })
}

// ── Render home ───────────────────────────────

async function renderHome() {
  // Get status from service worker (with timeout fallback)
  const session = await Promise.race([
    chrome.runtime.sendMessage({type:'GET_STATUS'}).then(r=>r?.session).catch(()=>null),
    new Promise(res=>setTimeout(()=>res(null),800))
  ])

  const [stats, config, streak, xp] = await Promise.all([
    getStats(), getConfig(), getStreak(), getXP()
  ])

  const totalToday = Object.values(stats).reduce((a,b)=>a+b,0)
  document.getElementById('s-total').textContent = totalToday>=60
    ? `${Math.floor(totalToday/60)}h${Math.round(totalToday%60)}m`
    : `${Math.round(totalToday)}m`
  document.getElementById('s-streak').textContent = streak.count
  document.getElementById('s-xp').textContent = xp.total
  document.getElementById('streak-days').textContent = `${streak.count} día${streak.count!==1?'s':''}`
  document.getElementById('streak-sub').textContent = streak.count===0 ? 'Empieza tu racha hoy' : streak.count<7 ? '¡Sigue así!' : '¡Imparable! 🔥'
  document.getElementById('shield-n').textContent = streak.shieldCount

  const hero  = document.getElementById('session-hero')
  const chip  = document.getElementById('status-chip')
  const dot   = document.getElementById('dot')
  const fill  = document.getElementById('prog-fill')
  const pause = document.getElementById('btn-pause')

  if (session) {
    const p     = PLATFORMS[session.pid]
    const cfg   = config[session.pid]
    const mins  = Math.round(stats[session.pid]||0)
    const limit = cfg?.limit || p?.limit || 30
    const ratio = Math.min(mins/limit, 1)
    const pct   = Math.round(ratio*100)

    document.getElementById('plat-ico').textContent = p?.emoji || '📱'
    document.getElementById('plat-name').textContent = p?.name || session.name
    document.getElementById('plat-sub').textContent = 'Sesión activa ahora'
    document.getElementById('timer-val').textContent = mins
    document.getElementById('timer-limit').textContent = `${limit} min`

    dot.className = `dot on${ratio>=1?' danger':ratio>=.75?' warn':''}`
    fill.style.width = pct+'%'
    fill.className = `prog-fill${ratio>=1?' danger':ratio>=.75?' warn':''}`
    hero.className = `${ratio>=1?'danger':ratio>=.75?'warn':''}`

    if (ratio>=1) {
      chip.textContent='⚠ Límite superado'; chip.className='status-chip danger'
    } else if (ratio>=.75) {
      chip.textContent='⚡ Atención'; chip.className='status-chip warn'
    } else {
      chip.textContent='Activo'; chip.className='status-chip'
    }

    document.getElementById('timer-val').style.color = ratio>=1?'var(--red)':ratio>=.75?'var(--amber)':'var(--text)'
    document.getElementById('timer-limit').querySelector('b').style.color = ratio>=1?'var(--red)':ratio>=.75?'var(--amber)':'var(--lime)'
    pause.disabled = false
  } else {
    const totalLimit = Object.values(config).reduce((a,c) => a + (c.limit||0), 0)
    document.getElementById('plat-ico').innerHTML = '<i class="fa-solid fa-bed" style="color: #a78bfa;"></i>'
    document.getElementById('plat-name').textContent = 'Sin actividad'
    document.getElementById('plat-sub').textContent = 'Abre TikTok o Instagram'
    document.getElementById('timer-val').textContent = Math.round(totalToday)
    document.getElementById('timer-limit').textContent = totalLimit > 0 ? `${totalLimit} min` : '—'
    fill.style.width = '0%'
    dot.className = 'dot'
    hero.className = ''
    chip.textContent = 'Activo'; chip.className = 'status-chip'
    pause.disabled = true
  }
}

// ── Render stats ──────────────────────────────

async function renderStats() {
  const [weekly, stats] = await Promise.all([getWeekly(), getStats()])
  const DAYS = ['L','M','X','J','V','S','D']
  const maxT  = Math.max(...weekly.map(d=>d.total), 1)
  const weekT = weekly.reduce((a,d)=>a+d.total, 0)

  const chart = document.getElementById('bar-chart')
  chart.innerHTML = ''
  weekly.forEach((day, i) => {
    const isToday = i === weekly.length-1
    const h = Math.max((day.total/maxT)*100, 3)
    const col = document.createElement('div')
    col.className = 'bar-col'
    col.innerHTML = `
      <div class="bar${isToday?' today':''}" style="height:${h}%" title="${day.total} min"></div>
      <span class="bar-d${isToday?' today':''}">${DAYS[i]}</span>
    `
    chart.appendChild(col)
  })
  document.getElementById('week-total').textContent = `${Math.round(weekT)} min`

  const total = Object.values(stats).reduce((a,b)=>a+b,0)||1
  const list  = document.getElementById('plat-list')
  list.innerHTML = ''
  const sorted = Object.entries(stats).sort((a,b)=>b[1]-a[1]).filter(([,m])=>m>=0.5)

  if (!sorted.length) { list.innerHTML = '<div class="empty">Sin datos de hoy todavía</div>'; return }

  sorted.forEach(([pid, mins]) => {
    const p   = PLATFORMS[pid]; if(!p) return
    const pct = Math.round((mins/total)*100)
    const row = document.createElement('div')
    row.className = 'plat-item'
    row.innerHTML = `
      <div class="plat-item-ico">${p.emoji}</div>
      <div class="plat-item-info">
        <div class="plat-item-name">${p.name}</div>
        <div class="plat-item-time">${Math.round(mins)} min hoy</div>
        <div class="plat-track"><div class="plat-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="plat-pct">${pct}%</div>
    `
    list.appendChild(row)
  })
}

// ── Render logros ─────────────────────────────

async function renderLogros() {
  const [xp, unlocked] = await Promise.all([getXP(), (g('achievements').then(r=>r||{}))])

  document.getElementById('xp-lvl').textContent   = xp.level
  document.getElementById('xp-name').textContent  = xp.name
  document.getElementById('xp-sub').textContent   = `Nivel ${xp.level} · ${xp.total} XP`
  document.getElementById('xp-total').textContent = `${xp.total} XP`
  document.getElementById('xp-fill').style.width  = `${xp.progress}%`

  const sorted = [...ACHIEVEMENTS].sort((a,b)=>!!unlocked[b.id]-!!unlocked[a.id])
  const list = document.getElementById('achiev-list')
  list.innerHTML = ''
  sorted.forEach(a => {
    const on  = !!unlocked[a.id]
    const div = document.createElement('div')
    div.className = `achiev-card${on?'':' locked'}`
    div.innerHTML = `
      <div class="achiev-emoji">${a.emoji}</div>
      <div class="achiev-info">
        <div class="achiev-name">${a.name}</div>
        <div class="achiev-desc">${a.desc}</div>
      </div>
      <div class="achiev-xp ${on?'unlocked':'locked'}">+${a.xp} XP</div>
    `
    list.appendChild(div)
  })
}

// ── Render config ─────────────────────────────

async function renderConfig() {
  const config = await getConfig()
  const list   = document.getElementById('cfg-list')
  list.innerHTML = ''

  Object.values(PLATFORMS).forEach(p => {
    const cfg = config[p.id]||{}
    const div = document.createElement('div')
    div.className = 'cfg-card'
    div.innerHTML = `
      <div class="cfg-ico">${p.emoji}</div>
      <div class="cfg-info">
        <div class="cfg-name">${p.name}</div>
        <div class="cfg-sub">minutos diarios</div>
      </div>
      <input class="cfg-input" type="number" min="1" max="480"
             value="${cfg.limit||p.limit}" data-pid="${p.id}" />
      <div class="toggle${cfg.enabled!==false?' on':''}" data-pid="${p.id}"></div>
    `
    list.appendChild(div)
  })

  // Input change
  list.querySelectorAll('.cfg-input').forEach(inp => {
    let t; inp.addEventListener('input', () => {
      clearTimeout(t)
      t = setTimeout(async () => {
        const v = parseInt(inp.value)
        if (v>0) {
          await chrome.runtime.sendMessage({type:'SAVE_CONFIG', platformId:inp.dataset.pid, updates:{limit:v}})
        }
      }, 600)
    })
  })

  // Toggle
  list.querySelectorAll('.toggle').forEach(tog => {
    tog.addEventListener('click', async () => {
      tog.classList.toggle('on')
      const enabled = tog.classList.contains('on')
      await chrome.runtime.sendMessage({type:'SAVE_CONFIG', platformId:tog.dataset.pid, updates:{enabled}})
    })
  })

  document.getElementById('tog-soft').addEventListener('click', function(){this.classList.toggle('on')})
  document.getElementById('tog-overlay').addEventListener('click', function(){this.classList.toggle('on')})
}

// ── Navigation ────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'))
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'))
    btn.classList.add('on')
    document.getElementById('tab-'+tab).classList.add('on')
  })
})

// ── Buttons ───────────────────────────────────

document.getElementById('btn-pause').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type:'ACCEPT_PAUSE'}).catch(()=>{})
  await renderHome()
})

document.getElementById('btn-dash').addEventListener('click', () => {
  chrome.tabs.create({url:'https://oyecomova.app'})
})

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([renderHome(), renderStats(), renderLogros(), renderConfig()])
}

init()
setInterval(renderHome, 15000)