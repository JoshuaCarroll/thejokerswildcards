function deeplinkWithFallback(deeplink) {
        const userAgent = window.navigator.userAgent;
        
        const isIOS = /iPhone|iPad/i.test(userAgent);
        const isAndroid = /Android/i.test(userAgent);
        const isMac = /Macintosh/i.test(userAgent);
        const isChrome = /Chrome|CriOS/i.test(userAgent);
        const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Edge|Edg/i.test(userAgent);
      
        // If none of these match, exit early
        if (!isIOS && !isAndroid && !(isMac && (isSafari || isChrome))) return;
        
        let fallback, url;
        let hasLeft = false;
      
        // 1. APPLE ENVIRONMENT LOGIC (iOS, iPadOS, macOS Safari, and macOS Chrome)
        if (isIOS || isMac) {
          fallback = "https://apps.apple.com/us/app/collx-sports-card-scanner/id1581164444?ls=1";
          
          // Set up listeners to catch if the app successfully opens 
          const handlePageHide = () => { hasLeft = true; };
          window.addEventListener('blur', handlePageHide);
          window.addEventListener('pagehide', handlePageHide);
          window.addEventListener('visibilitychange', handlePageHide);
      
          // --- TRIGGER THE DEEPLINK ---
          if (isMac && isChrome) {
            // Desktop Chrome fix: Create an invisible link and click it
            const hiddenAnchor = document.createElement('a');
            hiddenAnchor.href = deeplink;
            hiddenAnchor.style.display = 'none';
            document.body.appendChild(hiddenAnchor);
            hiddenAnchor.click();
            document.body.removeChild(hiddenAnchor);
          } else {
            // Safari (iOS & Mac) handles standard location assignments fine
            window.location.href = deeplink;
          }
      
          // --- MONITOR FALLBACK TIMER ---
          const start = Date.now();
          const interval = setInterval(() => {
            const elapsed = Date.now() - start;
      
            // App opened or browser lost focus
            if (hasLeft || document.hidden) {
              clearInterval(interval);
              cleanUp();
              return;
            }
      
            // Browser frozen by a native "Open app?" confirmation dialog
            if (elapsed > 2000) {
              clearInterval(interval);
              cleanUp();
              return;
            }
      
            // Time elapsed without interruptions: App is missing. Go to App Store.
            if (elapsed >= 1500) {
              clearInterval(interval);
              cleanUp();
              window.location.replace(fallback);
            }
          }, 50);
      
          function cleanUp() {
            window.removeEventListener('blur', handlePageHide);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('visibilitychange', handlePageHide);
          }
          
          return;
        }
      
        // 2. ANDROID ENVIRONMENT LOGIC
        if (isAndroid) {
          fallback = encodeURIComponent("https://play.google.com/store/apps/details?id=app.collx.android");
          let path = deeplink.replace('collx://', ''); 
          url = `intent://${path}#Intent;scheme=collx;package=app.collx.android;S.browser_fallback_url=${fallback};end`;
          
          console.log('url', url);
          window.location.replace(url); 
        }
      }