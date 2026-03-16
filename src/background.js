// OyeComoVa — Service Worker (corregido)

const PLATFORMS = {
  tiktok:    { id:'tiktok',    name:'TikTok',      emoji:'<i class="fa-brands fa-tiktok"></i>', hosts:['tiktok.com'],          limit:20 },
  instagram: { id:'instagram', name:'Instagram',    emoji:'<i class="fa-brands fa-instagram"></i>', hosts:['instagram.com'],       limit:30 },
  youtube:   { id:'youtube',   name:'YT Shorts',    emoji:'<i class="fa-brands fa-youtube" style="color: #ff0000;"></i>', hosts:['youtube.com'],         limit:15, onlyPath:'/shorts' },
  twitter:   { id:'twitter',   name:'X (Twitter)',  emoji:'<i class="fa-brands fa-x-twitter"></i>', hosts:['twitter.com','x.com'], limit:25 },
  facebook:  { id:'facebook',  name:'Facebook',     emoji:'<i class="fa-brands fa-facebook" style="color: #1877f2;"></i>', hosts:['facebook.com'],        limit:20 },
}

const MSGS = [
  '¿Cómo va tu tiempo? Ya llevas un buen rato aquí.',
  'Tu mente también necesita descanso, ¡oye!',
  'El scroll infinito puede esperar. Tú no.',
  '¿Hay algo más que quieras hacer hoy?',
  'Tu versión más productiva te está esperando.',
]

const ACTS = [
  {emoji:'<i class="fa-solid fa-person-walking" style="color: #a78bfa;"></i>', label:'Salir a caminar'},
  {emoji:'<i class="fa-solid fa-book-open" style="color: #4ecdc4;"></i>', label:'Leer algo'},
  {emoji:'<i class="fa-solid fa-droplet" style="color: #4ecdc4;"></i>', label:'Tomar agua'},
  {emoji:'<i class="fa-solid fa-bullseye" style="color: #ff5e5e;"></i>', label:'Retomar una tarea'},
  {emoji:'<i class="fa-solid fa-bed" style="color: #a78bfa;"></i>', label:'Descansar 10 min'},
]

// ── Storage ───────────────────────────────────

const today = () => new Date().toISOString().slice(0,10)

const API_URL = 'http://localhost:3000'

async function syncSession(pid, mins) {
  const token = await g('auth_token')
  if (!token) return
  fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ platform: pid, minutes: mins, date: today() })
  }).catch(() => {})
}

async function syncAchievement(achievementId) {
  const token = await g('auth_token')
  if (!token) return
  fetch(`${API_URL}/users/achievements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ achievementId })
  }).catch(() => {})
}

async function checkAchievements(pid, minsToday, limit) {
  const achiev = (await g('achievements')) || {}
  const streak = (await g('streak')) || {count: 0}
  let updated = false

  if (!achiev.first_day && minsToday > 0 && minsToday <= limit) {
    achiev.first_day = {unlockedAt: new Date().toISOString()}
    await addXP(100)
    await syncAchievement('first_day')
    updated = true
    console.log('[OCV] <i class="fa-solid fa-trophy"></i> Logro desbloqueado: first_day')
  }

  if (!achiev.streak_3 && streak.count >= 3) {
    achiev.streak_3 = {unlockedAt: new Date().toISOString()}
    await addXP(75)
    await syncAchievement('streak_3')
    updated = true
    console.log('[OCV] <i class="fa-solid fa-trophy"></i> Logro desbloqueado: streak_3')
  }

  if (!achiev.streak_7 && streak.count >= 7) {
    achiev.streak_7 = {unlockedAt: new Date().toISOString()}
    await addXP(150)
    await syncAchievement('streak_7')
    updated = true
    console.log('[OCV] <i class="fa-solid fa-trophy"></i> Logro desbloqueado: streak_7')
  }

  if (!achiev.streak_30 && streak.count >= 30) {
    achiev.streak_30 = {unlockedAt: new Date().toISOString()}
    await addXP(500)
    await syncAchievement('streak_30')
    updated = true
    console.log('[OCV] <i class="fa-solid fa-trophy"></i> Logro desbloqueado: streak_30')
  }

  if (updated) await s('achievements', achiev)
}

async function g(key) {
  const r = await chrome.storage.local.get(key)
  return r[key]
}
async function s(key, val) {
  return chrome.storage.local.set({[key]: val})
}

async function addMins(pid, mins) {
  if (mins <= 0) return
  const all = (await g('daily')) || {}
  const k = today()
  if (!all[k]) all[k] = {}
  all[k][pid] = Math.round(((all[k][pid]||0) + mins) * 100) / 100
  await s('daily', all)
}

async function getStats() {
  const all = (await g('daily')) || {}
  return all[today()] || {}
}

async function getConfig() {
  const saved = (await g('config')) || {}
  const def = {}
  Object.values(PLATFORMS).forEach(p => {
    def[p.id] = { limit: p.limit, enabled: true }
  })
  return {...def, ...saved}
}

async function addXP(n) {
  const xp = (await g('xp')) || {total:0}
  xp.total = Math.max(0, xp.total + n)
  await s('xp', xp)
}

// ── Platform detection ────────────────────────

function detect(url) {
  if (!url) return null
  try {
    const {hostname, pathname} = new URL(url)
    const host = hostname.replace('www.','')
    for (const p of Object.values(PLATFORMS)) {
      if (p.hosts.some(h => host.endsWith(h))) {
        if (p.onlyPath && !pathname.startsWith(p.onlyPath)) return null
        return p
      }
    }
  } catch{}
  return null
}

// ── Session ───────────────────────────────────

async function startSession(tabId, platform) {
  // Si hay sesión previa, guardar su tiempo antes de reemplazar
  const existing = await g('session')
  if (existing) {
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
    const lastSaved = Math.max(existing.lastSaved, startOfToday.getTime())
    const mins = (Date.now() - lastSaved) / 60000
    if (mins > 0.01) {
      await addMins(existing.pid, mins)
      console.log('[OCV] 💾', existing.name, '+' + Math.round(mins*100)/100 + ' min guardados')
    }
  }

  const now = Date.now()
  await s('session', {
    tabId,
    pid:        platform.id,
    name:       platform.name,
    emoji:      platform.emoji,
    startTime:  now,
    lastSaved:  now,   // ← marca de tiempo del último guardado
    alertLevel: null,
  })
  console.log('[OCV] ▶', platform.name)
}

async function endSession() {
  const sess = await g('session')
  if (!sess) return
  // Solo contar tiempo del día actual
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
  const lastSaved = Math.max(sess.lastSaved, startOfToday.getTime())
  const mins = (Date.now() - lastSaved) / 60000
  if (mins > 0.01) {
    await addMins(sess.pid, mins)
    syncSession(sess.pid, mins)
  }
  await chrome.storage.local.remove('session')
  console.log('[OCV] ⏹', sess.name, Math.round(mins*100)/100, 'min')
}

// ── Tick every 30s ────────────────────────────

async function tick() {
  const sess = await g('session')
  if (!sess) return

  const now = Date.now()
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0)
  // Solo contar desde inicio del día si lastSaved es de ayer
  const lastSaved = Math.max(sess.lastSaved, startOfToday.getTime())
  const mins = (now - lastSaved) / 60000

  if (mins > 0) {
    await addMins(sess.pid, mins)
    syncSession(sess.pid, mins) 
  }

  // Actualizar lastSaved para que el siguiente tick no cuente doble
  sess.lastSaved = now
  await s('session', sess)

  // Verificar alertas
  const config    = await getConfig()
  const stats     = await getStats()
  const cfg       = config[sess.pid]
  if (!cfg?.enabled) return

  const minsToday = stats[sess.pid] || 0
  const ratio     = minsToday / cfg.limit

  console.log('[OCV] ⏱', sess.name, Math.round(minsToday*10)/10 + '/' + cfg.limit + ' min', '(' + Math.round(ratio*100) + '%)')

  // We only increment the alert level string if we are crossing thresholds
  let level = null
  if      (ratio >= 1.0 && !['hard', 'hard_snoozed'].includes(sess.alertLevel)) level = 'hard'
  else if (ratio >= 0.75 && ratio < 1.0 && !['medium', 'medium_snoozed'].includes(sess.alertLevel)) level = 'medium'
  else if (ratio >= 0.5  && ratio < 0.75 && !['soft', 'soft_snoozed'].includes(sess.alertLevel)) level = 'soft'

  if (!level) return

  // NOTE: If we get here, it means we must display a new alert overlay/notification.
  // We keep the timers running regardless of what the user does.
  sess.alertLevel = level
  await s('session', sess)

  console.log('[OCV] 🚨', level, Math.round(minsToday) + '/' + cfg.limit + ' min')

  const msg = MSGS[Math.floor(Math.random()*MSGS.length)]
  const act = ACTS[Math.floor(Math.random()*ACTS.length)]

  if (level === 'soft') {
    chrome.notifications.create('ocv-' + Date.now(), {
      type:'basic', iconUrl:'icons/icon48.png',
      title:'👋 Oye, ¿cómo va?',
      message:`${Math.round(minsToday)} min en ${sess.name}. Límite: ${cfg.limit} min.`
    })
  } else {
  const [activeTab] = await chrome.tabs.query({active:true, currentWindow:true})
  const targetTabId = activeTab?.id || sess.tabId
  if (targetTabId) {
    chrome.tabs.sendMessage(targetTabId, {
      type:'SHOW_OVERLAY', level,
      platform:     sess.name,
      minutesToday: Math.round(minsToday),
      limit:        cfg.limit,
      message:      msg,
      activity:     act,
    }).catch((e)=>{ console.log('[OCV] Error sending overlay to tab', e) })
  }
  }

  await checkAchievements(sess.pid, minsToday, cfg.limit)
}

// ── Messages ──────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  ;(async () => {
    switch(msg.type) {
      case 'GET_STATUS': {
        const [sess, stats, config, streak, xpData] = await Promise.all([
          g('session'),
          getStats(),
          getConfig(),
          g('streak').then(r => r || {count:0, shieldCount:1}),
          g('xp').then(r => r || {total:0}),
        ])
        reply({session:sess||null, stats, config, streak, xp:xpData})
        break
      }
      case 'ACCEPT_PAUSE': {
        const sess = await g('session')
        await endSession()
        await addXP(50)
        const achiev = (await g('achievements')) || {}
        if (!achiev.first_pause) {
          achiev.first_pause = {unlockedAt: new Date().toISOString()}
          await s('achievements', achiev)
          await addXP(50)
          syncAchievement('first_pause')
        }
        if (!sender || !sender.tab) {
          if (sess && sess.tabId) {
            chrome.tabs.remove(sess.tabId).catch(() => {})
          }
        }
        reply({ok:true})
        break
      }
      case 'CLOSE_ME': {
        if (sender && sender.tab && sender.tab.id) {
          chrome.tabs.remove(sender.tab.id).catch(() => {})
        }
        reply({ok:true})
        break
      }
      case 'CONTINUE': {
        await addXP(-30)
        const sess = await g('session')
        if (sess) {
          if (sess.alertLevel && !sess.alertLevel.includes('snoozed')) {
            sess.alertLevel = sess.alertLevel + '_snoozed'
          }
          sess.lastSaved  = Date.now()
          await s('session', sess)
        }
        reply({ok:true})
        break
      }
      case 'SAVE_CONFIG': {
        const config = await getConfig()
        config[msg.platformId] = {...config[msg.platformId], ...msg.updates}
        await s('config', config)
        reply({ok:true})
        break
      }
            case 'LOGIN': {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: msg.email, password: msg.password })
          })
          const data = await res.json()
          if (data.token) {
            await s('auth_token', data.token)
            await s('auth_user', data.user)
            // Sincronizar logros locales al backend
            const localAchiev = (await g('achievements')) || {}
            for (const achievementId of Object.keys(localAchiev)) {
              fetch(`${API_URL}/users/achievements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
                body: JSON.stringify({ achievementId })
              }).catch(() => {})
            }
            reply({ ok: true, user: data.user })
          } else {
            reply({ ok: false, error: data.message })
          }
        } catch { reply({ ok: false, error: 'Sin conexión' }) }
        break
      }
      case 'REGISTER': {
        try {
          const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: msg.email, password: msg.password, name: msg.name })
          })
          const data = await res.json()
          if (data.token) {
            await s('auth_token', data.token)
            await s('auth_user', data.user)
            reply({ ok: true, user: data.user })
          } else {
            reply({ ok: false, error: data.message })
          }
        } catch { reply({ ok: false, error: 'Sin conexión' }) }
        break
      }
      case 'LOGOUT': {
        await chrome.storage.local.remove(['auth_token', 'auth_user'])
        reply({ ok: true })
        break
      }
      case 'GET_AUTH': {
        const token = await g('auth_token')
        const user  = await g('auth_user')
        reply({ token: token || null, user: user || null })
        break
      }
    }
  })()
  return true
})

// ── Tab listeners ─────────────────────────────

chrome.tabs.onActivated.addListener(async ({tabId}) => {
  const current = await g('session')
  // Misma pestaña — no reiniciar, solo continuar
  if (current?.tabId === tabId) return
  await endSession()
  const tab = await chrome.tabs.get(tabId).catch(()=>null)
  const p = detect(tab?.url)
  if (p) await startSession(tabId, p)
})

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  // Solo reaccionar a cambios de URL reales
  if (!info.url) return
  const [active] = await chrome.tabs.query({active:true, currentWindow:true})
  if (active?.id !== tabId) return
  const current = await g('session')
  const newPlat = detect(info.url)
  // Misma plataforma — no reiniciar
  if (current?.pid === newPlat?.id) return
  await endSession()
  if (newPlat) await startSession(tabId, newPlat)
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const current = await g('session')
  if (current?.tabId === tabId) await endSession()
})

chrome.windows.onFocusChanged.addListener(id => {
  if (id === chrome.windows.WINDOW_ID_NONE) endSession()
})

// Alarm cada 30 segundos
chrome.alarms.create('tick', {periodInMinutes: 0.5})
chrome.alarms.onAlarm.addListener(a => { if(a.name === 'tick') tick() })

console.log('[OCV] ✓ Service Worker ready')