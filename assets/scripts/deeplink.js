
function deeplinkWithFallback(deeplink) {
   const userAgent = window.navigator.userAgent || "";
   const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
   const isAndroid = /Android/i.test(userAgent);
   const isMac = /Macintosh/i.test(userAgent);
   const isChrome = /Chrome|CriOS/i.test(userAgent);
   const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Edge|Edg/i.test(userAgent);

   if (!isIOS && !isAndroid && !(isMac && (isSafari || isChrome))) {
      return;
   }

   const appStoreFallback = "https://apps.apple.com/us/app/collx-sports-card-scanner/id1581164444?ls=1";
   const playStoreFallback = "https://play.google.com/store/apps/details?id=app.collx.android";

   const cleanup = () => {
      window.removeEventListener("blur", handlePageHide);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("visibilitychange", handlePageHide);
      if (intervalId) {
         clearInterval(intervalId);
      }
   };

   const handlePageHide = () => {
      hasLeft = true;
   };

   let hasLeft = false;
   let intervalId = null;

   if (isIOS || isMac) {
      window.addEventListener("blur", handlePageHide);
      window.addEventListener("pagehide", handlePageHide);
      window.addEventListener("visibilitychange", handlePageHide);

      if (isMac && isChrome) {
         const hiddenAnchor = document.createElement("a");
         hiddenAnchor.href = deeplink;
         hiddenAnchor.style.display = "none";
         document.body.appendChild(hiddenAnchor);
         hiddenAnchor.click();
         document.body.removeChild(hiddenAnchor);
      } else {
         window.location.href = deeplink;
      }

      const start = Date.now();
      intervalId = window.setInterval(() => {
         const elapsed = Date.now() - start;

         if (hasLeft || document.hidden) {
            cleanup();
            return;
         }

         if (elapsed >= 1800) {
            cleanup();
            window.location.replace(appStoreFallback);
         }
      }, 100);

      return;
   }

   if (isAndroid) {
      const encodedFallback = encodeURIComponent(playStoreFallback);
      const path = deeplink.replace("collx://", "");
      const intentUrl = `intent://${path}#Intent;scheme=collx;package=app.collx.android;S.browser_fallback_url=${encodedFallback};end`;
      window.location.replace(intentUrl);
   }
}
