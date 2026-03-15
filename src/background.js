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
    const mins = (Date.now() - existing.lastSaved) / 60000
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
  const mins = (Date.now() - sess.lastSaved) / 60000
  if (mins > 0.01) await addMins(sess.pid, mins)
  await chrome.storage.local.remove('session')
  console.log('[OCV] ⏹', sess.name, Math.round(mins*100)/100, 'min')
}

// ── Tick every 30s ────────────────────────────

async function tick() {
  const sess = await g('session')
  if (!sess) return

  // Calcular tiempo real desde el último guardado
  const now  = Date.now()
  const mins = (now - sess.lastSaved) / 60000

  if (mins > 0) {
    await addMins(sess.pid, mins)
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
    // Attempt to find the active tab in the current window first, as this is the most reliable
    // place to show the overlay. Fallback to sess.tabId if we can't find one.
    let targetTabId = sess.tabId
    const [activeTab] = await chrome.tabs.query({active:true, currentWindow:true})
    if (activeTab && activeTab.url && activeTab.url.includes(sess.name.toLowerCase().replace(' ', ''))) {
       targetTabId = activeTab.id
    } else if (activeTab) {
       targetTabId = activeTab.id // Just send it to the active tab anyway if we can't be sure
    }

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