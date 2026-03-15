// OyeComoVa — Content Script

let scrollEvents = []
let alerted = false

function trackScroll() {
  const now = Date.now()
  scrollEvents = scrollEvents.filter(t => now - t < 8000)
  scrollEvents.push(now)
  if (scrollEvents.length / 8 >= 2 && !alerted) {
    alerted = true
    chrome.runtime.sendMessage({type:'SCROLL_FAST'}).catch(()=>{})
    setTimeout(() => { alerted = false }, 30000)
  }
}

window.addEventListener('scroll', trackScroll, {passive:true})

new MutationObserver(() => {
  document.querySelectorAll('[style*="overflow"]').forEach(el => {
    if (!el._ocv) {
      el._ocv = true
      el.addEventListener('scroll', trackScroll, {passive:true})
    }
  })
}).observe(document.body, {childList:true, subtree:true})

// ── Overlay ───────────────────────────────────

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'SHOW_OVERLAY') showOverlay(msg)
})

function showOverlay({level, platform, minutesToday, limit, message, activity}) {
  document.getElementById('_ocv')?.remove()
  document.getElementById('_ocv_s')?.remove()

  const wrap = document.createElement('div')
  wrap.id = '_ocv'
  wrap.innerHTML = `
    <div id="_ocv_c">
      <div id="_ocv_top">
        <div id="_ocv_ico">${level === 'hard' ? '<i class="fa-solid fa-triangle-exclamation" style="color: #ff5e5e;"></i>' : '<i class="fa-solid fa-bolt" style="color: #ffb347;"></i>'}</div>
        <div id="_ocv_pill">${minutesToday} min en ${platform}</div>
        <h2 id="_ocv_h">Oye, ¿cómo va?</h2>
        <p id="_ocv_p">${message}</p>
      </div>
      <div id="_ocv_btns">
        <button id="_b1"><i class="fa-solid fa-pause"></i>&nbsp; Tomar descanso</button>
        <button id="_b2">${activity.emoji}&nbsp; ${activity.label}</button>
        ${level==='hard'?`<button id="_b3">Continuar 15 min más &nbsp;<span>−30 XP</span></button>`:''}
        <button id="_b4">Recordarme luego</button>
      </div>
    </div>
  `

  const st = document.createElement('style')
  st.id = '_ocv_s'
  st.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
    @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
    #_ocv{position:fixed;inset:0;background:rgba(5,5,10,.85);backdrop-filter:blur(12px);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:_fi .2s ease}
    @keyframes _fi{from{opacity:0}to{opacity:1}}
    #_ocv_c{width:340px;background:#0d0d14;border:1px solid rgba(255,255,255,.08);border-radius:22px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04);animation:_su .3s cubic-bezier(.34,1.56,.64,1)}
    @keyframes _su{from{transform:translateY(28px) scale(.97);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
    #_ocv_top{padding:28px 24px 22px;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(200,241,53,.07) 0%,transparent 70%);border-bottom:1px solid rgba(255,255,255,.06)}
    #_ocv_ico{font-size:46px;display:block;margin-bottom:14px;filter:drop-shadow(0 0 12px rgba(200,241,53,.3));animation:_bo 1.4s ease-in-out infinite alternate}
    @keyframes _bo{from{transform:scale(1) rotate(-4deg)}to{transform:scale(1.1) rotate(4deg)}}
    #_ocv_pill{display:inline-block;background:rgba(200,241,53,.1);border:1px solid rgba(200,241,53,.25);border-radius:20px;padding:5px 16px;font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#c8f135;margin-bottom:14px;letter-spacing:-.01em}
    #_ocv_h{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#f0f0f5;margin:0 0 8px;letter-spacing:-.02em}
    #_ocv_p{font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(240,240,245,.5);margin:0;line-height:1.6;max-width:260px;margin:0 auto}
    #_ocv_btns{padding:16px;display:flex;flex-direction:column;gap:8px}
    #_ocv_btns button{width:100%;padding:12px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);color:#f0f0f5;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;letter-spacing:.01em}
    #_ocv_btns button:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.12);transform:translateY(-1px)}
    #_b1{background:#c8f135!important;color:#0a0a0f!important;border-color:#c8f135!important;font-weight:700!important;font-size:14px!important;box-shadow:0 4px 20px rgba(200,241,53,.25)!important}
    #_b1:hover{background:#d6f545!important;box-shadow:0 6px 28px rgba(200,241,53,.35)!important}
    #_b2{background:rgba(78,205,196,.08)!important;border-color:rgba(78,205,196,.2)!important;color:#4ecdc4!important}
    #_b3{background:transparent!important;color:rgba(240,240,245,.3)!important;font-size:12px!important}
    #_b3 span{background:rgba(255,107,107,.15);color:#ff6b6b;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700}
    #_b4{background:transparent!important;border:none!important;color:rgba(240,240,245,.2)!important;font-size:11px!important}
    #_b4:hover{color:rgba(240,240,245,.5)!important;transform:none!important}
  `

  document.head.appendChild(st)
  document.body.appendChild(wrap)

  document.getElementById('_b1').onclick = () => {
    chrome.runtime.sendMessage({type:'ACCEPT_PAUSE'})
    remove(); toast('¡Bien hecho! Disfruta tu descanso 🎉')
    setTimeout(() => { chrome.runtime.sendMessage({type:'CLOSE_ME'}) }, 2500)
  }
  document.getElementById('_b2').onclick = () => {
    chrome.runtime.sendMessage({type:'ACCEPT_PAUSE'})
    remove(); toast(`${activity.emoji} ¡Vamos! ${activity.label}`)
    setTimeout(() => { chrome.runtime.sendMessage({type:'CLOSE_ME'}) }, 2500)
  }
  document.getElementById('_b3')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({type:'CONTINUE'}); remove()
  })
  document.getElementById('_b4').onclick = () => {
    chrome.runtime.sendMessage({type:'CONTINUE'}); remove()
  }
}

function remove() {
  document.getElementById('_ocv')?.remove()
  document.getElementById('_ocv_s')?.remove()
}

function toast(text) {
  const t = document.createElement('div')
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(10px);background:#0d0d14;color:#f0f0f5;border:1px solid rgba(200,241,53,.3);border-radius:14px;padding:11px 20px;font-family:DM Sans,sans-serif;font-size:13px;font-weight:500;z-index:2147483647;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04);transition:all .3s cubic-bezier(.34,1.56,.64,1);opacity:0'
  t.textContent = text
  document.body.appendChild(t)
  requestAnimationFrame(() => {
    t.style.opacity = '1'
    t.style.transform = 'translateX(-50%) translateY(0)'
  })
  setTimeout(() => {
    t.style.opacity = '0'
    t.style.transform = 'translateX(-50%) translateY(10px)'
    setTimeout(() => t.remove(), 300)
  }, 3000)
}
