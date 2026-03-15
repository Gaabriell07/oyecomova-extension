# OyeComoVa - Extensión de Chrome

¡Hola! Esta es la extensión **OyeComoVa**, diseñada para ayudarte a recuperar el control de tu tiempo digital en redes sociales (TikTok, Instagram, YouTube Shorts, X y Facebook).

Esta extensión rastrea automáticamente el tiempo que pasas en estas páginas, te avisa cuando estás cerca de tu límite diario y te invita a tomar descansos si lo superas.

## Cómo instalarla en tu PC para probarla

Al no estar publicada aún en la Chrome Web Store, necesitas cargarla manualmente como desarrollador. Es súper rápido:

1. **Descarga o clona** esta carpeta en tu PC.
2. Abre tu navegador **Google Chrome** (o Edge/Brave).
3. Escribe en la barra de direcciones: `chrome://extensions/` y presiona Enter.
4. Arriba a la derecha, **activa el interruptor que dice "Modo de desarrollador"**.
5. Te aparecerán nuevos botones arriba a la izquierda. Haz clic en **"Cargar descomprimida"** (Load unpacked).
6. Se abrirá una ventana para elegir una carpeta. **Selecciona la carpeta raíz de este proyecto** (`ocv-final` o donde la hayas guardado).
7. ¡Listo! Verás la tarjeta de OyeComoVa.

## ¿Cómo funciona?

- Entra a una red social (ej. `tiktok.com`) y verás cómo el contador de la extensión empieza a sumar minutos automáticamente.
- Abre la ventana de la extensión dando clic a su ícono para ver tus estadísticas de hoy, gestionar tus tiempos límite y ver tus logros/rachas conseguidos.
- Si llegas a tu límite de tiempo, la extensión interceptará la pantalla con un aviso que te propondrá tomarte un respiro o salir a dar un paseo. Al aceptar, cerrará la pestaña por ti gentilmente.

---

_Cualquier cambio que hagamos en el código fuente (como en `background.js` o `content.js`), tendrás que volver a la página de `chrome://extensions/` y presionar el ícono de recarga 🔄 (la flecha circular en la tarjeta de OyeComoVa) para aplicar la última versión._
