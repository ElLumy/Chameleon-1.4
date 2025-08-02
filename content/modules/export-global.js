// content/modules/export-global.js
// Este script debe agregarse al final de cada módulo interceptor

// Para meta-proxy.js agregar:
if (typeof window !== 'undefined') {
  window.MetaProxyInterceptor = MetaProxyInterceptor;
}

// Para navigator.js agregar:
if (typeof window !== 'undefined') {
  window.NavigatorInterceptor = NavigatorInterceptor;
}

// Para screen.js agregar:
if (typeof window !== 'undefined') {
  window.ScreenInterceptor = ScreenInterceptor;
}

// Para canvas.js agregar:
if (typeof window !== 'undefined') {
  window.CanvasInterceptor = CanvasInterceptor;
}

// Para webgl.js agregar:
if (typeof window !== 'undefined') {
  window.WebGLInterceptor = WebGLInterceptor;
}

// Para audio.js agregar:
if (typeof window !== 'undefined') {
  window.AudioInterceptor = AudioInterceptor;
}

// Para timezone.js agregar:
if (typeof window !== 'undefined') {
  window.TimezoneInterceptor = TimezoneInterceptor;
}

// Para jitter.js agregar:
if (typeof window !== 'undefined') {
  window.JitterManager = JitterManager;
  window.jitter = jitter;
}