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

// ── Nav helper ────────────────────────────────

function goToTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'))
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'))
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('on')
  document.getElementById('tab-'+tabName)?.classList.add('on')
}

// ── Render home ───────────────────────────────

async function renderHome() {
  const session = await Promise.race([
    chrome.runtime.sendMessage({type:'GET_STATUS'}).then(r=>r?.session).catch(()=>null),
    new Promise(res=>setTimeout(()=>res(null),800))
  ])

  const [stats, config, streak, xp, token] = await Promise.all([
    getStats(), getConfig(), getStreak(), getXP(), g('auth_token')
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

  // Botón dashboard cambia según auth
  const btnDash = document.getElementById('btn-dash')
  if (!token) {
    btnDash.innerHTML = '<i class="fa-solid fa-user" style="font-size:11px"></i> Conectar'
  } else {
    btnDash.innerHTML = '<i class="fa-solid fa-chart-bar" style="font-size:11px"></i> Dashboard'
  }

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

    document.getElementById('plat-ico').innerHTML = p?.emoji || '📱'
    document.getElementById('plat-name').textContent = p?.name || session.name
    document.getElementById('plat-sub').textContent = 'Sesión activa ahora'
    document.getElementById('timer-val').textContent = mins
    document.getElementById('timer-limit').textContent = `${limit} min`

    dot.className = `dot on${ratio>=1?' danger':ratio>=.75?' warn':''}`
    fill.style.width = pct+'%'
    fill.className = `prog-fill${ratio>=1?' danger':ratio>=.75?' warn':''}`
    hero.className = ratio>=1?'danger':ratio>=.75?'warn':''

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
    document.getElementById('timer-limit').textContent = '—'
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
    const p = PLATFORMS[pid]; if(!p) return
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
  list.querySelectorAll('.cfg-input').forEach(inp => {
    let t; inp.addEventListener('input', () => {
      clearTimeout(t)
      t = setTimeout(async () => {
        const v = parseInt(inp.value)
        if (v>0) await chrome.runtime.sendMessage({type:'SAVE_CONFIG', platformId:inp.dataset.pid, updates:{limit:v}})
      }, 600)
    })
  })
  list.querySelectorAll('.toggle').forEach(tog => {
    tog.addEventListener('click', async () => {
      tog.classList.toggle('on')
      await chrome.runtime.sendMessage({type:'SAVE_CONFIG', platformId:tog.dataset.pid, updates:{enabled:tog.classList.contains('on')}})
    })
  })
  document.getElementById('tog-soft').addEventListener('click', function(){this.classList.toggle('on')})
  document.getElementById('tog-overlay').addEventListener('click', function(){this.classList.toggle('on')})
}

// ── Render cuenta ─────────────────────────────

async function renderCuenta() {
  const [token, user] = await Promise.all([g('auth_token'), g('auth_user')])
  const view = document.getElementById('tab-cuenta')
  if (!view) return

  if (token && user) {
    view.innerHTML = `
      <div style="padding:20px 16px;display:flex;flex-direction:column;gap:12px">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:16px;display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;background:var(--lime);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;color:#080810;font-size:17px;flex-shrink:0">
            ${(user.name||user.email||'U')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700">${user.name||'Usuario'}</div>
            <div style="font-size:11px;color:var(--muted)">${user.email}</div>
          </div>
        </div>
        <div style="background:rgba(200,241,53,.06);border:1px solid rgba(200,241,53,.12);border-radius:var(--r);padding:12px 14px;font-size:12px;color:var(--muted)">
          ✅ Tus datos se sincronizan con el servidor
        </div>
        <button id="btn-open-dash" style="width:100%;padding:11px;border-radius:var(--r);background:var(--lime);color:#080810;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer">
          Abrir Dashboard →
        </button>
        <button id="btn-logout" style="width:100%;padding:10px;border-radius:var(--r);background:transparent;color:var(--muted);border:1px solid var(--border);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer">
          Cerrar sesión
        </button>
      </div>
    `
    document.getElementById('btn-open-dash').onclick = async () => {
      const t = await g('auth_token')
      chrome.tabs.create({ url: `http://localhost:5173?token=${t}` })
    }
    document.getElementById('btn-logout').onclick = async () => {
      await chrome.runtime.sendMessage({ type: 'LOGOUT' })
      renderCuenta()
      renderHome()
    }
  } else {
    view.innerHTML = `
      <div style="padding:20px 16px;display:flex;flex-direction:column;gap:10px">
        <div style="text-align:center;padding:12px 0 6px">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:6px">Conecta tu cuenta</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">Sincroniza tus datos y accede al dashboard</div>
        </div>
        <div id="auth-error" style="display:none;background:rgba(255,94,94,.1);border:1px solid rgba(255,94,94,.2);border-radius:var(--r);padding:10px 12px;font-size:11px;color:var(--red)"></div>
        <div style="display:flex;background:var(--card);border-radius:var(--r);padding:3px;gap:2px">
          <button class="auth-tab" data-form="login" style="flex:1;padding:7px;border:none;border-radius:10px;background:var(--card2);color:var(--text);font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer">Iniciar sesión</button>
          <button class="auth-tab" data-form="register" style="flex:1;padding:7px;border:none;border-radius:10px;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer">Registrarse</button>
        </div>
        <div id="form-login" style="display:flex;flex-direction:column;gap:8px">
          <input id="login-email" type="email" placeholder="Email" style="width:100%;padding:10px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
          <input id="login-pass" type="password" placeholder="Contraseña" style="width:100%;padding:10px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
          <button id="btn-login" style="width:100%;padding:11px;border-radius:var(--r);background:var(--lime);color:#080810;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer">Entrar</button>
        </div>
        <div id="form-register" style="display:none;flex-direction:column;gap:8px">
          <input id="reg-name" type="text" placeholder="Nombre" style="width:100%;padding:10px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
          <input id="reg-email" type="email" placeholder="Email" style="width:100%;padding:10px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
          <input id="reg-pass" type="password" placeholder="Contraseña" style="width:100%;padding:10px 12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
          <button id="btn-register" style="width:100%;padding:11px;border-radius:var(--r);background:var(--lime);color:#080810;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer">Crear cuenta</button>
        </div>
      </div>
    `
    view.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        view.querySelectorAll('.auth-tab').forEach(t => {
          t.style.background = 'transparent'; t.style.color = 'var(--muted)'; t.style.fontWeight = '400'
        })
        tab.style.background = 'var(--card2)'; tab.style.color = 'var(--text)'; tab.style.fontWeight = '600'
        document.getElementById('form-login').style.display    = tab.dataset.form==='login'    ? 'flex' : 'none'
        document.getElementById('form-register').style.display = tab.dataset.form==='register' ? 'flex' : 'none'
      })
    })

    function showError(msg) {
      const el = document.getElementById('auth-error')
      el.textContent = msg; el.style.display = 'block'
    }

    document.getElementById('btn-login').onclick = async () => {
      const email = document.getElementById('login-email').value.trim()
      const password = document.getElementById('login-pass').value
      if (!email || !password) return showError('Completa todos los campos')
      const btn = document.getElementById('btn-login')
      btn.textContent = 'Entrando...'; btn.disabled = true
      const res = await chrome.runtime.sendMessage({ type:'LOGIN', email, password })
      if (res.ok) { renderCuenta(); renderHome() }
      else { showError(res.error||'Credenciales incorrectas'); btn.textContent='Entrar'; btn.disabled=false }
    }

    document.getElementById('btn-register').onclick = async () => {
      const name = document.getElementById('reg-name').value.trim()
      const email = document.getElementById('reg-email').value.trim()
      const password = document.getElementById('reg-pass').value
      if (!email || !password) return showError('Email y contraseña son requeridos')
      const btn = document.getElementById('btn-register')
      btn.textContent = 'Creando...'; btn.disabled = true
      const res = await chrome.runtime.sendMessage({ type:'REGISTER', email, password, name })
      if (res.ok) { renderCuenta(); renderHome() }
      else { showError(res.error||'Error al registrarse'); btn.textContent='Crear cuenta'; btn.disabled=false }
    }
  }
}

// ── Navigation ────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab
    goToTab(tab)
    if (tab === 'cuenta') renderCuenta()
  })
})

// ── Buttons ───────────────────────────────────

document.getElementById('btn-pause').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type:'ACCEPT_PAUSE'}).catch(()=>{})
  await renderHome()
})

document.getElementById('btn-dash').addEventListener('click', async () => {
  const token = await g('auth_token')
  if (token) {
    chrome.tabs.create({ url: `http://localhost:5173?token=${token}` })
  } else {
    goToTab('cuenta')
    renderCuenta()
  }
})

// ── Init ──────────────────────────────────────

async function init() {
  await Promise.all([renderHome(), renderStats(), renderLogros(), renderConfig()])
}

init()
setInterval(renderHome, 15000)