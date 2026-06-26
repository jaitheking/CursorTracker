if ('serviceWorker' in navigator) {
    window.addEventListener('load', (): void => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg: ServiceWorkerRegistration) => {
                console.log('Service Worker registered successfully!');

                // 1. Check if an updated service worker is already waiting in the background
                if (reg.waiting) {
                    showUpdateBanner(reg.waiting);
                }

                // 2. Listen for future updates found while the app is running
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateBanner(newWorker);
                            }
                        });
                    }
                });
            })
            .catch((err: Error) => console.log('Service Worker registration failed:', err));
    });

    // 3. Reload the window cleanly once the new Service Worker activates and takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', (): void => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

function showUpdateBanner(worker: ServiceWorker): void {
    const banner = document.getElementById('updateBanner') as HTMLDivElement | null;
    const reloadBtn = document.getElementById('reloadBtn') as HTMLButtonElement | null;
    
    if (!banner || !reloadBtn) return;

    banner.classList.remove('hidden');
    
    // Trigger skipWaiting message on click to kick out the old Service Worker instantly
    reloadBtn.onclick = (): void => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    };
}