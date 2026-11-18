// =====================================================
// Inspección Visual PWA - app.js
// JavaScript Vanilla con Promesas (.then / .catch / .finally)
// =====================================================

let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

const visorVideo = document.getElementById('visor-camara');
const visorVacio = document.getElementById('visor-vacio');
const btnInstalar = document.getElementById('btn-instalar');
const btnPreparar = document.getElementById('btn-preparar-camara');
const btnConfirmar = document.getElementById('btn-confirmar-permiso');
const btnCancelar = document.getElementById('btn-cancelar-permiso');
const btnAlternar = document.getElementById('btn-alternar-camara');
const btnApagar = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');

// ---------- Utilidades ----------
function actualizarMensajeEstado(texto){
  document.getElementById('mensaje-estado').textContent = texto;
}

function actualizarControles(camaraEncendida){
  btnAlternar.disabled = !camaraEncendida;
  btnApagar.disabled = !camaraEncendida;
  visorVacio.hidden = camaraEncendida;
}

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => {
        console.log('Service Worker registrado con scope:', registro.scope);
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
}

// ---------- Instalación (Android / Chrome) ----------
window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();
  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        btnInstalar.hidden = true;
        actualizarMensajeEstado('Aplicación instalada correctamente.');
      } else {
        actualizarMensajeEstado('Instalación cancelada.');
      }
    })
    .catch((error) => {
      console.error('Error en la instalación:', error);
    })
    .finally(() => {
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
});

// ---------- Instalación (iOS / Safari) ----------
function verificarEntornoIOS(){
  const esIOS = (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) ||
                // iPadOS 13+ se reporta como Mac con pantalla táctil
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const estaInstalada = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

  // Si está en iPhone y aún la ve desde el navegador, mostrar instrucciones manuales
  if (esIOS && !estaInstalada) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) guiaIOS.hidden = false;
  }
}

document.getElementById('btn-cerrar-ios').addEventListener('click', () => {
  document.getElementById('instrucciones-ios').hidden = true;
});

verificarEntornoIOS();

// ---------- Cámara ----------
function detenerCamaraActiva(){
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function iniciarCamara(modo){
  // Liberar el sensor antes de pedir otro (obligatorio en iOS/WebKit)
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no permite acceder a la cámara. Abre la app desde HTTPS.');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  btnAlternar.disabled = true;
  actualizarMensajeEstado('Encendiendo cámara...');

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      // En iOS a veces el autoplay necesita un play() explícito
      const reproduccion = visorVideo.play();
      if (reproduccion && reproduccion.catch) {
        reproduccion.catch(() => {});
      }
      actualizarControles(true);
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
    })
    .catch((error) => {
      actualizarControles(false);
      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está ocupada por otra aplicación o no se liberó a tiempo. Intenta de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    })
    .finally(() => {
      btnAlternar.disabled = streamActual === null;
    });
}

// Paso 1: El usuario pulsa "Solicitar Acceso a Cámara" -> Mostramos aviso explicativo
btnPreparar.addEventListener('click', () => {
  avisoPermiso.hidden = false;
  avisoPermiso.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Paso 2: El usuario lee el motivo y pulsa "Aceptar y Encender Cámara"
btnConfirmar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

btnCancelar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('No se solicitó el permiso. Puedes intentarlo cuando quieras.');
});

// Alternar entre trasera y frontal
btnAlternar.addEventListener('click', () => {
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
  iniciarCamara(modoCamaraActual);
});

// Apagar cámara
btnApagar.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarControles(false);
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Liberar la cámara si la app pasa a segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.hidden && streamActual) {
    detenerCamaraActiva();
    visorVideo.srcObject = null;
    actualizarControles(false);
    actualizarMensajeEstado('Cámara apagada al salir de la app.');
  }
});
