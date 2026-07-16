if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('TCH Service Worker registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  });
}
