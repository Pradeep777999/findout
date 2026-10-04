/**
 * FindMyThing - Web Push Notifications Client
 * Manages push notification permission, service worker subscription,
 * and server sync using standard Web Push API and VAPID.
 */

(function () {
  // Utility: Convert URL-safe base64 string to Uint8Array for applicationServerKey
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if Web Push is supported by the current browser/OS
  function isPushSupported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  // Get active Service Worker registration
  async function getRegistration() {
    if (!("serviceWorker" in navigator)) return null;
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
    return reg;
  }

  // Get current subscription status
  async function getSubscriptionStatus() {
    if (!isPushSupported()) {
      return {
        supported: false,
        permission: "unsupported",
        isSubscribed: false,
        statusText: "Not supported on this browser"
      };
    }

    const permission = Notification.permission; // 'default', 'granted', 'denied'

    try {
      const reg = await getRegistration();
      if (!reg) {
        return {
          supported: true,
          permission,
          isSubscribed: false,
          statusText: "Service Worker unavailable"
        };
      }

      const subscription = await reg.pushManager.getSubscription();
      const isSubscribed = !!subscription && permission === "granted";

      let statusText = "Notifications disabled";
      if (!isSubscribed) {
        if (permission === "denied") {
          statusText = "Blocked in browser settings";
        } else {
          statusText = "Permission not granted";
        }
      } else {
        statusText = "Notifications enabled";
      }

      return {
        supported: true,
        permission,
        isSubscribed,
        statusText,
        subscription
      };
    } catch (err) {
      console.error("[Push Client] Error checking subscription status:", err);
      return {
        supported: true,
        permission,
        isSubscribed: false,
        statusText: "Error checking status"
      };
    }
  }

  // Subscribe current device
  async function subscribe() {
    if (!isPushSupported()) {
      throw new Error("Push notifications are not supported on this browser.");
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (permission === "denied") {
        throw new Error(
          "Notification permission was denied. Please allow notifications in your browser site settings."
        );
      }
      throw new Error("Notification permission was dismissed.");
    }

    // 2. Fetch server VAPID public key
    const res = await fetch("/api/push/public-key");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to retrieve VAPID key from server.");
    }
    const { publicKey } = await res.json();
    if (!publicKey) {
      throw new Error("Server did not return a valid VAPID public key.");
    }

    // 3. Register service worker and subscribe to PushManager
    const reg = await getRegistration();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // 4. Send subscription to server
    const saveRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent
      })
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to save subscription on server.");
    }

    return subscription;
  }

  // Unsubscribe current device
  async function unsubscribe() {
    if (!isPushSupported()) return true;

    try {
      const reg = await getRegistration();
      if (!reg) return true;

      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        // Notify backend first
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        }).catch((e) => console.warn("[Push Client] Error notifying backend of unsubscription:", e));

        // Unsubscribe locally
        await subscription.unsubscribe();
      }
      return true;
    } catch (err) {
      console.error("[Push Client] Error unsubscribing:", err);
      throw err;
    }
  }

  // Send a test push notification to user's device(s)
  async function sendTestNotification() {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to trigger test notification.");
    }
    return data;
  }

  // Auto register service worker on window load if supported
  if ("serviceWorker" in navigator) {
    if (document.readyState === "complete") {
      getRegistration().catch((e) => console.warn("[Push Client] SW registration:", e));
    } else {
      window.addEventListener("load", () => {
        getRegistration().catch((e) => console.warn("[Push Client] SW registration:", e));
      });
    }
  }

  // Expose global interface
  window.FindMyThingPush = {
    isPushSupported,
    getSubscriptionStatus,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
})();

