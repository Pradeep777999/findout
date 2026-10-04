/* ==========================================
   ANVESHANA (FindMyThing) NAVIGATION SCRIPT
   ========================================== */

(function () {
  // Elements
  let navbarEl = null;
  let drawerTrigger = null;
  let mobileDrawer = null;
  let drawerOverlay = null;
  let drawerClose = null;
  let translateElement = null;

  // Session State
  let currentUser = null; // { name, role }

  // Initializing Navbar
  function initNavbar() {
    // Find existing navbar container
    navbarEl = document.getElementById('mainNavbar') || document.querySelector('.navbar');
    if (!navbarEl) {
      console.warn("FindMyThing Redesign: Navbar container not found. Expected <nav class='navbar' id='mainNavbar'>.");
      return;
    }

    // Standardize ID
    navbarEl.id = 'mainNavbar';
    navbarEl.className = 'navbar';

    // Build Desktop & Mobile Header inside the container
    navbarEl.innerHTML = `
      <!-- Hamburger Button (Mobile Only) -->
      <button class="hamburger-btn" id="drawerTrigger" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobileDrawer">
        ☰
      </button>

      <!-- LEFT SIDE (PROFILE BUTTON + MITS LOGO + BRAND) -->
      <div class="nav-left-group">
        <div class="nav-profile-wrapper" id="desktopNavProfileContainer" style="display: none;">
          <button class="nav-profile-btn" id="desktopNavProfileBtn" type="button" aria-label="User Profile" title="Open My Profile">
            <span class="nav-profile-icon">👤</span>
            <span class="nav-profile-name" id="navProfileName">Profile</span>
          </button>
        </div>

        <div class="nav-brand">
          <a href="/">
            <img src="/images/findback.png" class="mits-logo" alt="MITS Logo">
            <div class="nav-brand-text-container">
              <div class="nav-brand-text">FindMyThing</div>
              <div class="nav-brand-sub">MITS Portal</div>
            </div>
          </a>
        </div>
      </div>

      <!-- CENTER: USER & NAVIGATION LINKS (Desktop) -->
      <div class="nav-center" id="desktopNavCenter">
        <!-- Mobile banner image (visible only on mobile) -->
        <img src="/images/findnav.png" alt="MITS Banner" class="mits-banner-img mobile-only-banner">
        
        <div class="nav-center-inner">
          <span id="welcomeUser" style="display: none;"></span>
          <div id="desktopNavLinksContainer">
            <!-- Navigation links injected here -->
          </div>
        </div>
      </div>

      <!-- RIGHT SIDE: ACTIONS & CONTROLS (Desktop Only) -->
      <div class="nav-right" id="desktopNavLinks">
        <div id="desktopNavActionsContainer" class="nav-actions-container">
          <!-- Notification Bell, Push Alerts, Logout / Login / Register -->
        </div>
        <div id="google_translate_element_desktop_target"></div>
      </div>
    `;

    // Ensure side drawer and overlay elements exist in the DOM
    ensureDrawerDOM();

    // Ensure profile modal exists in DOM
    ensureProfileModalDOM();

    // Setup elements
    drawerTrigger = document.getElementById('drawerTrigger');
    mobileDrawer = document.getElementById('mobileDrawer');
    drawerOverlay = document.getElementById('drawerOverlay');
    drawerClose = document.getElementById('drawerClose');

    // Global escape key to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeProfileModal();
        if (mobileDrawer && mobileDrawer.classList.contains('open')) {
          closeDrawer();
        }
      }
    });

    // Get or Create Google Translate element
    translateElement = document.getElementById('google_translate_element');
    if (!translateElement) {
      translateElement = document.createElement('div');
      translateElement.id = 'google_translate_element';
      document.body.appendChild(translateElement);
    }

    // Set active link and fetch session to populate items
    fetchSessionAndUpdate();

    // Hook drawer events
    setupDrawerEvents();

    // Setup Google Translate responsive position
    repositionTranslateWidget();
    window.addEventListener('resize', repositionTranslateWidget);

    // Apply initial dark theme setting
    if (localStorage.getItem('dark-mode') === 'enabled') {
      document.body.classList.add('dark-theme');
    }
  }

  // Ensure drawer elements are appended to body
  function ensureDrawerDOM() {
    if (!document.getElementById('mobileDrawer')) {
      const drawerHTML = `
        <div id="mobileDrawer" role="dialog" aria-modal="true" aria-label="Navigation Menu" tabindex="-1">
          <!-- Redesigned Header -->
          <div class="m-drawer-header">
            <button class="drawer-close-btn" id="drawerClose" aria-label="Close menu">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="white"/>
              </svg>
            </button>
            <img src="/images/findback.png" class="m-header-logo" alt="MITS Logo">
            <h2 class="m-header-title">FindMyThing</h2>
            <p class="m-header-subtitle">Campus Lost & Found Portal</p>
          </div>
          
          <div class="drawer-body">
            <!-- Profile Section -->
            <div id="m-drawer-profile" class="m-profile-section"></div>
            
            <!-- Menu Items Container (White/Glass Card) -->
            <div class="m-menu-card">
              <div id="drawerNavLinksContainer" style="display: flex; flex-direction: column;">
                <!-- Links injected here -->
              </div>
            </div>
            
            <!-- Bottom Section -->
            <div class="m-drawer-bottom">
              <div class="m-bottom-info">
                <span class="m-version">FindMyThing v1.0</span>
                <img src="/images/findback.png" class="m-bottom-logo" alt="MITS Logo">
              </div>
              <div class="m-bottom-links">
                <a href="#">Privacy Policy</a>
                <span class="m-dot">•</span>
                <a href="#">Terms</a>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', drawerHTML);
    }

    if (!document.getElementById('drawerOverlay')) {
      const overlayHTML = `<div id="drawerOverlay"></div>`;
      document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }
  }

  // Fetch session data and update links in Desktop and Mobile
  function fetchSessionAndUpdate() {
    fetch("/api/user")
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          currentUser = data;
        } else {
          currentUser = null;
        }
        renderLinks();
      })
      .catch(err => {
        console.error("Error checking user session:", err);
        currentUser = null;
        renderLinks();
      });
  }

  // Render navigation links dynamically
  function renderLinks() {
    const currentPath = window.location.pathname;

    // Check if active page
    const isHome = currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/');
    const isItems = currentPath.includes('/items.html');
    const isMyItems = currentPath.includes('/my-items.html');
    const isCollected = currentPath.includes('/collected.html');
    const isReportLost = currentPath.includes('/report-lost.html');
    const isReportFound = currentPath.includes('/report-found.html');
    const isManager = currentPath.includes('/manager.html');
    const isAdmin = currentPath.includes('/admin.html');
    const isAnalytics = currentPath.includes('/analytics.html');

    // Define Link Lists
    // Page links available for navigation
    const pages = [
      { name: 'Home', href: '/', active: isHome, icon: '🏠' },
      { name: 'All Items', href: '/items.html', active: isItems, icon: '📋' },
      { name: 'Collected', href: '/collected.html', active: isCollected, icon: '📦' }
    ];

    if (currentUser) {
      pages.push({ name: 'My Items', href: '/my-items.html', active: isMyItems, icon: '👤' });
      pages.push({ name: 'Report Lost', href: '/report-lost.html', active: isReportLost, icon: '😞' });
      pages.push({ name: 'Report Found', href: '/report-found.html', active: isReportFound, icon: '😀' });
    }

    // Role-based links
    const privilegedLinks = [];
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'manager') {
        privilegedLinks.push({ name: 'Manager Panel', href: '/manager.html', active: isManager, icon: '👨‍💼' });
        privilegedLinks.push({ name: 'Analytics', href: '/analytics.html', active: isAnalytics, icon: '📊' });
      }
      if (currentUser.role === 'admin') {
        privilegedLinks.push({ name: 'Admin Panel', href: '/admin.html', active: isAdmin, icon: '⚙️' });
      }
    }

    // --- RENDER DESKTOP ---
    const desktopLinksContainer = document.getElementById('desktopNavLinksContainer');
    const desktopActionsContainer = document.getElementById('desktopNavActionsContainer') || desktopLinksContainer;
    const welcomeUserEl = document.getElementById('welcomeUser');
    
    if (desktopLinksContainer) {
      desktopLinksContainer.innerHTML = '';
    }
    if (desktopActionsContainer && desktopActionsContainer !== desktopLinksContainer) {
      desktopActionsContainer.innerHTML = '';
    }

    if (currentUser) {
      // Setup Desktop Profile Button on Left
      const desktopProfileContainer = document.getElementById('desktopNavProfileContainer');
      const navProfileName = document.getElementById('navProfileName');
      const navProfileBtn = document.getElementById('desktopNavProfileBtn');

      if (desktopProfileContainer) {
        desktopProfileContainer.style.display = 'flex';
        if (navProfileName) navProfileName.innerText = currentUser.name || 'Profile';
        if (navProfileBtn && !navProfileBtn._boundProfile) {
          navProfileBtn._boundProfile = true;
          navProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openProfileModal();
          });
        }
      }

      // Hide center welcome text since user profile is now prominently on the left
      if (welcomeUserEl) {
        welcomeUserEl.style.display = 'none';
      }

      // Always show page links in CENTER
      pages.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.innerText = p.name;
        if (p.active) a.className = 'active';
        desktopLinksContainer.appendChild(a);
      });

      // Show Privileged Panels in CENTER
      privilegedLinks.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.innerText = p.name;
        a.className = p.active ? 'btn-primary active' : 'btn-primary';
        desktopLinksContainer.appendChild(a);
      });

      // In-App Notification Bell & Dropdown in RIGHT
      const bellWrapper = document.createElement('div');
      bellWrapper.className = 'nav-bell-wrapper';
      bellWrapper.id = 'desktopBellWrapper';
      bellWrapper.innerHTML = `
        <button class="nav-bell-btn" id="desktopBellBtn" type="button" aria-label="Notifications" title="In-App Notifications">
          <span class="bell-icon">🔔</span>
          <span class="bell-badge" id="desktopBellBadge" style="display:none;">0</span>
        </button>
        <div class="nav-notification-dropdown" id="desktopNotifDropdown">
          <div class="notif-dropdown-header">
            <div class="notif-dropdown-title">
              <span>Notifications</span>
              <span class="notif-unread-tag" id="desktopNotifUnreadTag">0 new</span>
            </div>
            <button class="notif-mark-all-btn" id="desktopNotifMarkAllBtn" type="button">Mark all read</button>
          </div>
          <div class="notif-dropdown-body" id="desktopNotifDropdownBody">
            <div class="notif-empty-state">
              <div class="notif-empty-icon">🔔</div>
              <div class="notif-empty-text">Loading notifications...</div>
            </div>
          </div>
          <div class="notif-dropdown-footer">
            <a href="/my-items.html" class="notif-footer-link">View My Reports & Matches →</a>
          </div>
        </div>
      `;
      desktopActionsContainer.appendChild(bellWrapper);

      // Push Notifications Button in RIGHT
      const pushBtn = document.createElement('button');
      pushBtn.id = 'desktopPushNavBtn';
      pushBtn.type = 'button';
      pushBtn.className = 'nav-push-btn';
      pushBtn.innerHTML = `📱 <span id="desktopPushBtnLabel">Push Alerts</span>`;
      pushBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openDesktopPushModal();
      });
      desktopActionsContainer.appendChild(pushBtn);

      // Logout button in RIGHT
      const logoutBtn = document.createElement('a');
      logoutBtn.href = '/logout';
      logoutBtn.innerText = 'Logout';
      logoutBtn.className = 'nav-logout-link';
      desktopActionsContainer.appendChild(logoutBtn);

    } else {
      // Guest Links
      const desktopProfileContainer = document.getElementById('desktopNavProfileContainer');
      if (desktopProfileContainer) {
        desktopProfileContainer.style.display = 'none';
      }

      if (welcomeUserEl) {
        welcomeUserEl.style.display = 'none';
      }

      // General public pages in CENTER
      pages.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.innerText = p.name;
        if (p.active) a.className = 'active';
        desktopLinksContainer.appendChild(a);
      });

      // Actions in RIGHT
      const loginBtn = document.createElement('a');
      loginBtn.href = '/login.html';
      loginBtn.innerText = 'Login';
      loginBtn.className = 'nav-login-link';
      desktopActionsContainer.appendChild(loginBtn);

      const registerBtn = document.createElement('a');
      registerBtn.href = '/register.html';
      registerBtn.innerText = 'Register';
      registerBtn.className = 'btn-primary nav-register-link';
      desktopActionsContainer.appendChild(registerBtn);
    }

    // Render Role Badge next to Logo if on my-items page and logged in
    const existingBadge = document.querySelector('.nav-role-badge');
    if (existingBadge) existingBadge.remove();

    if (currentUser && (isMyItems || isAdmin || isManager)) {
      const brandContainer = document.querySelector('#mainNavbar .nav-brand');
      if (brandContainer) {
        const badge = document.createElement('div');
        badge.className = 'nav-role-badge';
        const roleText = currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'manager' ? 'Manager' : 'Student/Staff';
        badge.innerHTML = `<span class="rbadge-dot"></span>${roleText}`;
        brandContainer.appendChild(badge);
      }
    }

    // --- RENDER MOBILE DRAWER ---
    const drawerContainer = document.getElementById('drawerNavLinksContainer');
    const profileEl = document.getElementById('m-drawer-profile');
    drawerContainer.innerHTML = '';

    if (currentUser) {
      const initials = currentUser.name
        ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';
      let email = 'student@mits.ac.in';
      if (currentUser.name) {
        let nameParts = currentUser.name.toLowerCase().split(' ');
        let username = nameParts.filter(p => p.length > 0).join('.');
        email = `${username}@mits.ac.in`;
      }
      const displayEmail = currentUser.email || email;
      profileEl.innerHTML = `
        <div class="m-profile-avatar user">
          <span class="m-avatar-initials">${initials}</span>
          <span class="m-online-indicator"></span>
        </div>
        <div class="m-profile-info">
          <div class="m-profile-welcome">Welcome</div>
          <div class="m-profile-name">${currentUser.name}</div>
          <div class="m-profile-email">${displayEmail}</div>
        </div>
      `;
      profileEl.style.cursor = 'pointer';
      profileEl.title = 'Open Profile Settings';
      profileEl.onclick = () => {
        closeDrawer();
        openProfileModal();
      };

      // In-App Notifications link in Mobile Drawer
      const notifDrawerLink = document.createElement('div');
      notifDrawerLink.className = 'drawer-link m-notif-link';
      notifDrawerLink.id = 'drawerNotifLink';
      notifDrawerLink.style.cursor = 'pointer';
      notifDrawerLink.innerHTML = `
        <span style="display:flex; align-items:center; gap:14px; font-weight:600;">
          <span class="icon">🔔</span> Notifications
        </span>
        <span class="m-notif-badge" id="drawerNotifBadge" style="display:none;">0</span>
      `;
      drawerContainer.appendChild(notifDrawerLink);

      // Profile link in Mobile Drawer
      const profileDrawerLink = document.createElement('div');
      profileDrawerLink.className = 'drawer-link m-profile-link';
      profileDrawerLink.id = 'drawerProfileLink';
      profileDrawerLink.style.cursor = 'pointer';
      profileDrawerLink.innerHTML = `
        <span style="display:flex; align-items:center; gap:14px; font-weight:600;">
          <span class="icon">👤</span> Profile
        </span>
        <span style="color: var(--nav-gold); font-size: 16px; margin-left: auto;">›</span>
      `;
      profileDrawerLink.addEventListener('click', () => {
        closeDrawer();
        openProfileModal();
      });
      drawerContainer.appendChild(profileDrawerLink);

      // Render standard pages links
      pages.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.className = p.active ? 'drawer-link active' : 'drawer-link';
        a.innerHTML = `<span class="icon">${p.icon}</span> ${p.name}`;
        drawerContainer.appendChild(a);
      });

      // Render privileged links
      privilegedLinks.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.className = p.active ? 'drawer-link active' : 'drawer-link';
        a.innerHTML = `<span class="icon">${p.icon}</span> ${p.name}`;
        drawerContainer.appendChild(a);
      });
    } else {
      profileEl.innerHTML = `
        <div class="m-profile-avatar guest">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#cbd5e1"/>
          </svg>
        </div>
        <div class="m-profile-info">
          <div class="m-profile-welcome">Welcome</div>
          <div class="m-profile-name">Guest User</div>
        </div>
        <div class="m-profile-actions">
          <a href="/login.html" class="m-profile-btn login">Login</a>
          <a href="/register.html" class="m-profile-btn register">Register</a>
        </div>
      `;

      // Render standard public pages
      pages.forEach(p => {
        const a = document.createElement('a');
        a.href = p.href;
        a.className = p.active ? 'drawer-link active' : 'drawer-link';
        a.innerHTML = `<span class="icon">${p.icon}</span> ${p.name}`;
        drawerContainer.appendChild(a);
      });

      // Render Login & Register links in list
      const aLogin = document.createElement('a');
      aLogin.href = '/login.html';
      aLogin.className = currentPath.includes('/login.html') ? 'drawer-link active' : 'drawer-link';
      aLogin.innerHTML = `<span class="icon">🔐</span> Login`;
      drawerContainer.appendChild(aLogin);

      const aRegister = document.createElement('a');
      aRegister.href = '/register.html';
      aRegister.className = currentPath.includes('/register.html') ? 'drawer-link active' : 'drawer-link';
      aRegister.innerHTML = `<span class="icon">📝</span> Register`;
      drawerContainer.appendChild(aRegister);
    }

    // Google Translate / Language link inside drawer links
    const aLang = document.createElement('div');
    aLang.className = 'drawer-link m-lang-item';
    aLang.innerHTML = `
      <span style="display:flex; align-items:center; gap:14px;">
        <span class="icon">🌐</span> Language
      </span>
      <div id="google_translate_element_mobile_target" class="m-translate-target"></div>
    `;
    drawerContainer.appendChild(aLang);

    // Help link
    const aHelp = document.createElement('a');
    aHelp.id = 'drawerHelpLink';
    aHelp.href = '/#notice';
    aHelp.className = 'drawer-link m-help-item';
    aHelp.innerHTML = `<span class="icon">❓</span> Help`;
    drawerContainer.appendChild(aHelp);

    // Contact link
    const aContact = document.createElement('a');
    aContact.id = 'drawerContactLink';
    aContact.href = 'tel:9160482396';
    aContact.className = 'drawer-link m-contact-item';
    aContact.innerHTML = `<span class="icon">📞</span> Contact`;
    drawerContainer.appendChild(aContact);

    // System Push Notifications (Mobile Drawer - Logged in users)
    if (currentUser) {
      const aPush = document.createElement('div');
      aPush.className = 'drawer-link m-push-item';
      aPush.id = 'drawerPushItem';
      aPush.innerHTML = `
        <div class="m-push-row">
          <span class="m-push-title">
            <span class="icon">🔔</span> System Notifications
          </span>
          <span class="m-toggle-switch" id="drawerPushToggle" role="switch" aria-checked="false" title="Toggle System Notifications">
            <span class="m-toggle-knob"></span>
          </span>
        </div>
        <div class="m-push-row" style="margin-top: 4px;">
          <span class="m-push-status" id="drawerPushStatus">Checking status...</span>
          <button type="button" class="m-push-test-btn" id="drawerPushTestBtn" style="display:none;" title="Send a test notification to this device">Test Push</button>
        </div>
      `;
      drawerContainer.appendChild(aPush);

      const drawerToggle = aPush.querySelector('#drawerPushToggle');
      if (drawerToggle) drawerToggle.addEventListener('click', handlePushToggleClick);

      const drawerTest = aPush.querySelector('#drawerPushTestBtn');
      if (drawerTest) drawerTest.addEventListener('click', handlePushTestClick);
    }

    // Dark Mode link
    const aDarkMode = document.createElement('a');
    aDarkMode.href = '#';
    aDarkMode.className = 'drawer-link m-dark-toggle';
    aDarkMode.id = 'drawerDarkMode';
    aDarkMode.innerHTML = `
      <span style="display:flex; align-items:center; gap:14px;">
        <span class="icon">🌙</span> Dark Mode
      </span>
      <span class="m-toggle-switch"><span class="m-toggle-knob"></span></span>
    `;
    drawerContainer.appendChild(aDarkMode);

    // Dark mode listener hook
    aDarkMode.addEventListener('click', function (e) {
      e.preventDefault();
      const body = document.body;
      const isDark = body.classList.toggle('dark-theme');
      localStorage.setItem('dark-mode', isDark ? 'enabled' : 'disabled');
      updateDarkModeToggleUI();
    });

    updateDarkModeToggleUI();

    // Render Logout at the very bottom of the card if logged in
    if (currentUser) {
      const aLogout = document.createElement('a');
      aLogout.href = '/logout';
      aLogout.className = 'drawer-link';
      aLogout.innerHTML = `<span class="icon">🚪</span> Logout`;
      drawerContainer.appendChild(aLogout);
    }

    // Attach in-app notification events
    if (currentUser) {
      setupNotificationListeners();
    }

    // Sync push notification status in UI
    ensurePushScriptLoaded().then(() => syncPushUI());
  }

  // Dark Mode Switch UI Helper
  function updateDarkModeToggleUI() {
    const switchEl = document.querySelector('#drawerDarkMode .m-toggle-switch');
    if (switchEl) {
      if (document.body.classList.contains('dark-theme')) {
        switchEl.classList.add('active');
      } else {
        switchEl.classList.remove('active');
      }
    }
  }

  // ======================================================
  // WEB PUSH NOTIFICATIONS HELPERS & MODAL
  // ======================================================

  function ensurePushScriptLoaded() {
    if (window.FindMyThingPush) return Promise.resolve();
    return new Promise((resolve) => {
      const existing = document.querySelector('script[src*="push-notifications.js"]');
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', resolve);
        return;
      }
      const script = document.createElement('script');
      script.src = '/js/push-notifications.js';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  async function syncPushUI() {
    if (!window.FindMyThingPush) return;
    try {
      const status = await window.FindMyThingPush.getSubscriptionStatus();
      
      const drawerStatus = document.getElementById('drawerPushStatus');
      const drawerToggle = document.getElementById('drawerPushToggle');
      const drawerTestBtn = document.getElementById('drawerPushTestBtn');

      const modalStatus = document.getElementById('modalPushStatus');
      const modalToggle = document.getElementById('modalPushToggle');
      const modalTestBtn = document.getElementById('modalPushTestBtn');

      const desktopBtn = document.getElementById('desktopPushNavBtn');
      const desktopLabel = document.getElementById('desktopPushBtnLabel');

      let statusLabel = status.statusText || "Notifications disabled";
      if (status.isSubscribed) {
        statusLabel = "Notifications enabled";
      } else if (status.permission === "denied") {
        statusLabel = "Blocked in browser";
      } else if (!status.supported) {
        statusLabel = "Not supported";
      } else {
        statusLabel = "Permission not granted";
      }

      // Update mobile drawer elements
      if (drawerStatus) {
        drawerStatus.innerText = statusLabel;
        drawerStatus.className = 'm-push-status' + (status.isSubscribed ? ' active' : (status.permission === 'denied' ? ' blocked' : ''));
      }
      if (drawerToggle) {
        if (status.isSubscribed) {
          drawerToggle.classList.add('active');
          drawerToggle.setAttribute('aria-checked', 'true');
        } else {
          drawerToggle.classList.remove('active');
          drawerToggle.setAttribute('aria-checked', 'false');
        }
      }
      if (drawerTestBtn) {
        drawerTestBtn.style.display = status.isSubscribed ? 'inline-block' : 'none';
      }

      // Update desktop modal elements
      if (modalStatus) {
        modalStatus.innerText = statusLabel;
        modalStatus.className = 'm-push-status' + (status.isSubscribed ? ' active' : (status.permission === 'denied' ? ' blocked' : ''));
      }
      if (modalToggle) {
        if (status.isSubscribed) {
          modalToggle.classList.add('active');
          modalToggle.setAttribute('aria-checked', 'true');
        } else {
          modalToggle.classList.remove('active');
          modalToggle.setAttribute('aria-checked', 'false');
        }
      }
      if (modalTestBtn) {
        modalTestBtn.style.display = status.isSubscribed ? 'inline-block' : 'none';
      }

      // Update desktop navbar button
      if (desktopBtn) {
        if (status.isSubscribed) {
          desktopBtn.classList.add('active');
        } else {
          desktopBtn.classList.remove('active');
        }
      }
      if (desktopLabel) {
        desktopLabel.innerText = status.isSubscribed ? 'Alerts: On' : 'Alerts: Off';
      }
    } catch (err) {
      console.warn("[Navbar] Push status sync error:", err);
    }
  }

  async function handlePushToggleClick(e) {
    if (e) e.preventDefault();
    await ensurePushScriptLoaded();
    if (!window.FindMyThingPush) return;

    const status = await window.FindMyThingPush.getSubscriptionStatus();
    if (!status.supported) {
      alert("Web Push notifications are not supported on this browser.");
      return;
    }

    if (status.permission === "denied") {
      alert("Notifications are blocked in your browser settings. Please enable notifications for this site to receive alerts.");
      return;
    }

    try {
      if (status.isSubscribed) {
        await window.FindMyThingPush.unsubscribe();
      } else {
        await window.FindMyThingPush.subscribe();
      }
    } catch (err) {
      console.error("Push toggle error:", err);
      alert(err.message || "Failed to update notification settings.");
    }

    await syncPushUI();
  }

  async function handlePushTestClick(e) {
    if (e) e.preventDefault();
    await ensurePushScriptLoaded();
    if (!window.FindMyThingPush) return;

    const btn = e.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "...";

    try {
      await window.FindMyThingPush.sendTestNotification();
      btn.innerText = "Sent!";
      setTimeout(() => {
        btn.disabled = false;
        btn.innerText = originalText;
      }, 2500);
    } catch (err) {
      console.error("Test notification error:", err);
      alert(err.message || "Failed to trigger test notification.");
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }

  function openDesktopPushModal() {
    let modal = document.getElementById('pushModalOverlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pushModalOverlay';
      modal.className = 'push-modal-overlay';
      modal.innerHTML = `
        <div class="push-modal-card" role="dialog" aria-modal="true" aria-labelledby="pushModalTitle">
          <div class="push-modal-header">
            <div class="push-modal-title" id="pushModalTitle">🔔 System Notifications</div>
            <button type="button" class="push-modal-close" id="pushModalClose" aria-label="Close dialog">&times;</button>
          </div>
          <p class="push-modal-desc">
            Receive real-time system alerts on your phone and computer when items matching your reports are posted or collected.
          </p>
          <div class="push-modal-setting-row">
            <div class="push-modal-setting-info">
              <span class="push-modal-setting-label">System notifications</span>
              <span class="m-push-status" id="modalPushStatus">Checking status...</span>
            </div>
            <span class="m-toggle-switch" id="modalPushToggle" role="switch" aria-checked="false" title="Toggle System Notifications">
              <span class="m-toggle-knob"></span>
            </span>
          </div>
          <div class="push-modal-actions">
            <button type="button" class="push-modal-btn-test" id="modalPushTestBtn" style="display:none;" title="Send a test notification to this browser">Send Test</button>
            <button type="button" class="push-modal-btn-done" id="pushModalDone">Done</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('pushModalClose').onclick = () => modal.remove();
      document.getElementById('pushModalDone').onclick = () => modal.remove();
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

      const mToggle = document.getElementById('modalPushToggle');
      if (mToggle) mToggle.onclick = handlePushToggleClick;

      const mTest = document.getElementById('modalPushTestBtn');
      if (mTest) mTest.onclick = handlePushTestClick;
    }
    syncPushUI();
  }

  // ======================================================
  // PROFILE MANAGEMENT MODAL & SYSTEM
  // ======================================================
  let profileModalOverlayEl = null;

  function ensureProfileModalDOM() {
    let overlay = document.getElementById('profileModalOverlay');
    if (overlay) {
      profileModalOverlayEl = overlay;
      return overlay;
    }

    overlay = document.createElement('div');
    overlay.id = 'profileModalOverlay';
    overlay.className = 'profile-modal-overlay';
    overlay.innerHTML = `
      <div class="profile-modal-card" id="profileModalCard" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
        <button type="button" class="profile-modal-close" id="profileModalClose" aria-label="Close Profile">&times;</button>
        
        <!-- Header -->
        <div class="profile-card-header">
          <div class="profile-avatar-container">
            <div class="profile-avatar-circle" id="profileModalAvatar">👤</div>
            <span class="profile-status-indicator" title="Active Account"></span>
          </div>
          <h3 class="profile-card-title" id="profileModalName">My Profile</h3>
          <p class="profile-card-email" id="profileModalEmail">user@mits.ac.in</p>
          <div class="profile-card-role-badge" id="profileModalRole">Student / Staff</div>
        </div>

        <!-- Alert Box -->
        <div class="profile-alert-box" id="profileAlertBox" style="display: none;"></div>

        <!-- Main Profile Menu -->
        <div class="profile-view-section" id="profileMainView">
          <div class="profile-options-list">
            <button type="button" class="profile-option-row" id="profileOptChangeName">
              <div class="p-opt-left">
                <span class="p-opt-icon">✏️</span>
                <div class="p-opt-info">
                  <span class="p-opt-title">Change Name</span>
                  <span class="p-opt-subtitle">Update your display name</span>
                </div>
              </div>
              <span class="p-opt-arrow">›</span>
            </button>

            <button type="button" class="profile-option-row" id="profileOptChangePassword">
              <div class="p-opt-left">
                <span class="p-opt-icon">🔑</span>
                <div class="p-opt-info">
                  <span class="p-opt-title">Change Password</span>
                  <span class="p-opt-subtitle">Update your password securely</span>
                </div>
              </div>
              <span class="p-opt-arrow">›</span>
            </button>

            <button type="button" class="profile-option-row" id="profileOptForgotPassword">
              <div class="p-opt-left">
                <span class="p-opt-icon">🔐</span>
                <div class="p-opt-info">
                  <span class="p-opt-title">Forgot Password</span>
                  <span class="p-opt-subtitle">Reset password with email verification</span>
                </div>
              </div>
              <span class="p-opt-arrow">›</span>
            </button>
          </div>

          <div class="profile-bottom-actions">
            <button type="button" class="profile-btn-close-bottom" id="profileCloseBottomBtn">Close</button>
          </div>
        </div>

        <!-- View: Change Name -->
        <div class="profile-view-section" id="profileChangeNameView" style="display: none;">
          <div class="p-sub-header">
            <button type="button" class="p-sub-back-btn" id="pBackFromNameBtn">← Back</button>
            <h4 class="p-sub-title">Change Name</h4>
          </div>
          <form id="pFormChangeName" class="p-sub-form">
            <div class="p-field">
              <label for="pCurrentName">Current Name</label>
              <input type="text" id="pCurrentName" readonly class="p-input-readonly">
            </div>
            <div class="p-field">
              <label for="pNewName">New Name</label>
              <input type="text" id="pNewName" placeholder="Enter new full name" required maxlength="80">
            </div>
            <div class="p-form-actions">
              <button type="button" class="p-btn-cancel" id="pCancelNameBtn">Cancel</button>
              <button type="submit" class="p-btn-save" id="pSaveNameBtn">Save Changes</button>
            </div>
          </form>
        </div>

        <!-- View: Change Password -->
        <div class="profile-view-section" id="profileChangePasswordView" style="display: none;">
          <div class="p-sub-header">
            <button type="button" class="p-sub-back-btn" id="pBackFromPasswordBtn">← Back</button>
            <h4 class="p-sub-title">Change Password</h4>
          </div>
          <form id="pFormChangePassword" class="p-sub-form">
            <div class="p-field">
              <label for="pCurrentPassword">Current Password</label>
              <input type="password" id="pCurrentPassword" placeholder="Enter current password" required autocomplete="current-password">
            </div>
            <div class="p-field">
              <label for="pNewPassword">New Password</label>
              <input type="password" id="pNewPassword" placeholder="Minimum 6 characters" required minlength="6" autocomplete="new-password">
            </div>
            <div class="p-field">
              <label for="pConfirmPassword">Confirm New Password</label>
              <input type="password" id="pConfirmPassword" placeholder="Re-enter new password" required minlength="6" autocomplete="new-password">
            </div>
            <div class="p-form-actions">
              <button type="button" class="p-btn-cancel" id="pCancelPasswordBtn">Cancel</button>
              <button type="submit" class="p-btn-save" id="pSavePasswordBtn">Update Password</button>
            </div>
          </form>
        </div>

        <!-- View: Forgot Password (OTP Flow) -->
        <div class="profile-view-section" id="profileForgotPasswordView" style="display: none;">
          <div class="p-sub-header">
            <button type="button" class="p-sub-back-btn" id="pBackFromForgotBtn">← Back</button>
            <h4 class="p-sub-title">Reset Password</h4>
          </div>

          <!-- Step 1: Send OTP -->
          <div id="pForgotStep1">
            <p class="p-step-desc">A 6-digit verification code will be sent to your registered email address.</p>
            <div class="p-field">
              <label>Registered Email</label>
              <input type="email" id="pForgotEmail" readonly class="p-input-readonly">
            </div>
            <div class="p-form-actions">
              <button type="button" class="p-btn-cancel" id="pCancelForgotBtn">Cancel</button>
              <button type="button" class="p-btn-save" id="pSendOtpBtn">Send Verification OTP</button>
            </div>
            <div class="p-forgot-extra-link">
              <a href="/reset.html" id="pDirectResetLink">Or open standard Reset Page →</a>
            </div>
          </div>

          <!-- Step 2: Verify OTP -->
          <div id="pForgotStep2" style="display: none;">
            <p class="p-step-desc">Enter the 6-digit code sent to your email:</p>
            <div class="p-field">
              <label for="pForgotOtpInput">Verification Code</label>
              <input type="text" id="pForgotOtpInput" placeholder="e.g. 123456" maxlength="6" pattern="[0-9]{6}">
            </div>
            <div class="p-form-actions">
              <button type="button" class="p-btn-cancel" id="pBackToStep1Btn">Back</button>
              <button type="button" class="p-btn-save" id="pVerifyOtpBtn">Verify OTP</button>
            </div>
          </div>

          <!-- Step 3: Set New Password -->
          <div id="pForgotStep3" style="display: none;">
            <p class="p-step-desc">OTP verified! Choose a new password for your account:</p>
            <form id="pFormForgotReset" class="p-sub-form">
              <div class="p-field">
                <label for="pForgotNewPass">New Password</label>
                <input type="password" id="pForgotNewPass" placeholder="Minimum 6 characters" required minlength="6">
              </div>
              <div class="p-field">
                <label for="pForgotConfirmPass">Confirm New Password</label>
                <input type="password" id="pForgotConfirmPass" placeholder="Re-enter new password" required minlength="6">
              </div>
              <div class="p-form-actions">
                <button type="submit" class="p-btn-save" id="pSubmitForgotResetBtn">Set New Password</button>
              </div>
            </form>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    profileModalOverlayEl = overlay;

    // Attach modal close events
    const closeBtn = document.getElementById('profileModalClose');
    const bottomCloseBtn = document.getElementById('profileCloseBottomBtn');
    if (closeBtn) closeBtn.onclick = closeProfileModal;
    if (bottomCloseBtn) bottomCloseBtn.onclick = closeProfileModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeProfileModal();
    };

    // Subview triggers
    const optName = document.getElementById('profileOptChangeName');
    const optPassword = document.getElementById('profileOptChangePassword');
    const optForgot = document.getElementById('profileOptForgotPassword');

    if (optName) optName.onclick = () => switchProfileView('changeName');
    if (optPassword) optPassword.onclick = () => switchProfileView('changePassword');
    if (optForgot) optForgot.onclick = () => switchProfileView('forgotPassword');

    // Back / Cancel buttons
    const backName = document.getElementById('pBackFromNameBtn');
    const cancelName = document.getElementById('pCancelNameBtn');
    if (backName) backName.onclick = () => switchProfileView('main');
    if (cancelName) cancelName.onclick = () => switchProfileView('main');

    const backPass = document.getElementById('pBackFromPasswordBtn');
    const cancelPass = document.getElementById('pCancelPasswordBtn');
    if (backPass) backPass.onclick = () => switchProfileView('main');
    if (cancelPass) cancelPass.onclick = () => switchProfileView('main');

    const backForgot = document.getElementById('pBackFromForgotBtn');
    const cancelForgot = document.getElementById('pCancelForgotBtn');
    if (backForgot) backForgot.onclick = () => switchProfileView('main');
    if (cancelForgot) cancelForgot.onclick = () => switchProfileView('main');

    // Forms submission
    const formName = document.getElementById('pFormChangeName');
    if (formName) formName.onsubmit = handleSaveName;

    const formPass = document.getElementById('pFormChangePassword');
    if (formPass) formPass.onsubmit = handleSavePassword;

    // Forgot Password OTP handlers
    const sendOtpBtn = document.getElementById('pSendOtpBtn');
    if (sendOtpBtn) sendOtpBtn.onclick = handleSendForgotOtp;

    const verifyOtpBtn = document.getElementById('pVerifyOtpBtn');
    if (verifyOtpBtn) verifyOtpBtn.onclick = handleVerifyForgotOtp;

    const backToStep1Btn = document.getElementById('pBackToStep1Btn');
    if (backToStep1Btn) backToStep1Btn.onclick = () => showForgotStep(1);

    const formForgotReset = document.getElementById('pFormForgotReset');
    if (formForgotReset) formForgotReset.onsubmit = handleSubmitForgotReset;

    return overlay;
  }

  function switchProfileView(viewName) {
    clearProfileAlert();
    const mainView = document.getElementById('profileMainView');
    const nameView = document.getElementById('profileChangeNameView');
    const passView = document.getElementById('profileChangePasswordView');
    const forgotView = document.getElementById('profileForgotPasswordView');

    if (mainView) mainView.style.display = viewName === 'main' ? 'block' : 'none';
    if (nameView) nameView.style.display = viewName === 'changeName' ? 'block' : 'none';
    if (passView) passView.style.display = viewName === 'changePassword' ? 'block' : 'none';
    if (forgotView) {
      forgotView.style.display = viewName === 'forgotPassword' ? 'block' : 'none';
      if (viewName === 'forgotPassword') {
        showForgotStep(1);
      }
    }

    if (viewName === 'changeName') {
      const curInput = document.getElementById('pCurrentName');
      const newInput = document.getElementById('pNewName');
      if (curInput && currentUser) curInput.value = currentUser.name || '';
      if (newInput) {
        newInput.value = '';
        setTimeout(() => newInput.focus(), 100);
      }
    } else if (viewName === 'changePassword') {
      const curPass = document.getElementById('pCurrentPassword');
      const newPass = document.getElementById('pNewPassword');
      const confPass = document.getElementById('pConfirmPassword');
      if (curPass) curPass.value = '';
      if (newPass) newPass.value = '';
      if (confPass) confPass.value = '';
      if (curPass) setTimeout(() => curPass.focus(), 100);
    } else if (viewName === 'forgotPassword') {
      const emailInput = document.getElementById('pForgotEmail');
      const directLink = document.getElementById('pDirectResetLink');
      if (emailInput && currentUser) emailInput.value = currentUser.email || '';
      if (directLink && currentUser && currentUser.email) {
        directLink.href = `/reset.html?email=${encodeURIComponent(currentUser.email)}`;
      }
    }
  }

  function showForgotStep(stepNum) {
    clearProfileAlert();
    const s1 = document.getElementById('pForgotStep1');
    const s2 = document.getElementById('pForgotStep2');
    const s3 = document.getElementById('pForgotStep3');
    if (s1) s1.style.display = stepNum === 1 ? 'block' : 'none';
    if (s2) s2.style.display = stepNum === 2 ? 'block' : 'none';
    if (s3) s3.style.display = stepNum === 3 ? 'block' : 'none';
  }

  function showProfileAlert(msg, type = 'success') {
    const alertBox = document.getElementById('profileAlertBox');
    if (!alertBox) return;
    alertBox.className = 'profile-alert-box ' + type;
    alertBox.innerText = msg;
    alertBox.style.display = 'block';
  }

  function clearProfileAlert() {
    const alertBox = document.getElementById('profileAlertBox');
    if (alertBox) {
      alertBox.className = 'profile-alert-box';
      alertBox.innerText = '';
      alertBox.style.display = 'none';
    }
  }

  function openProfileModal() {
    if (!currentUser) {
      window.location.href = '/login.html';
      return;
    }

    const overlay = ensureProfileModalDOM();
    const nameEl = document.getElementById('profileModalName');
    const emailEl = document.getElementById('profileModalEmail');
    const roleEl = document.getElementById('profileModalRole');
    const avatarEl = document.getElementById('profileModalAvatar');

    const initials = currentUser.name
      ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : '👤';

    if (nameEl) nameEl.innerText = currentUser.name || 'User';
    if (emailEl) emailEl.innerText = currentUser.email || (currentUser.name ? currentUser.name.toLowerCase().replace(/\\s+/g, '.') + '@mits.ac.in' : 'student@mits.ac.in');
    if (roleEl) {
      roleEl.innerText = currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'manager' ? 'Staff / Manager' : 'Student / Staff';
    }
    if (avatarEl) avatarEl.innerText = initials;

    switchProfileView('main');
    overlay.classList.add('active');
    document.body.classList.add('profile-modal-active');
  }

  function closeProfileModal() {
    if (profileModalOverlayEl) {
      profileModalOverlayEl.classList.remove('active');
    }
    document.body.classList.remove('profile-modal-active');
  }

  // Handle Save Name
  async function handleSaveName(e) {
    e.preventDefault();
    clearProfileAlert();

    const input = document.getElementById('pNewName');
    const saveBtn = document.getElementById('pSaveNameBtn');
    if (!input) return;

    const newName = input.value.trim();
    if (!newName) {
      showProfileAlert("Please enter a valid name.", "error");
      return;
    }

    if (newName === currentUser.name) {
      showProfileAlert("The new name is identical to your current name.", "error");
      return;
    }

    const originalText = saveBtn ? saveBtn.innerText : "Save Changes";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "Saving...";
    }

    try {
      const res = await fetch("/api/user/change-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showProfileAlert(data.error || "Failed to update name.", "error");
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = originalText;
        }
        return;
      }

      // Update in-memory user
      currentUser.name = data.name;

      // Update UI displays across navbar & modal immediately
      const navProfileName = document.getElementById('navProfileName');
      if (navProfileName) navProfileName.innerText = currentUser.name;

      const profileModalName = document.getElementById('profileModalName');
      if (profileModalName) profileModalName.innerText = currentUser.name;

      const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const modalAvatar = document.getElementById('profileModalAvatar');
      if (modalAvatar) modalAvatar.innerText = initials;

      const drawerName = document.querySelector('.m-profile-name');
      if (drawerName) drawerName.innerText = currentUser.name;

      const drawerAvatar = document.querySelector('.m-avatar-initials');
      if (drawerAvatar) drawerAvatar.innerText = initials;

      showProfileAlert("✓ Name updated successfully!", "success");

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
      }

      setTimeout(() => {
        switchProfileView('main');
      }, 1200);

    } catch (err) {
      console.error("Change name error:", err);
      showProfileAlert("Network error while updating name.", "error");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
      }
    }
  }

  // Handle Save Password
  async function handleSavePassword(e) {
    e.preventDefault();
    clearProfileAlert();

    const curPassInput = document.getElementById('pCurrentPassword');
    const newPassInput = document.getElementById('pNewPassword');
    const confPassInput = document.getElementById('pConfirmPassword');
    const saveBtn = document.getElementById('pSavePasswordBtn');

    const currentPassword = curPassInput ? curPassInput.value : '';
    const newPassword = newPassInput ? newPassInput.value : '';
    const confirmPassword = confPassInput ? confPassInput.value : '';

    if (!currentPassword) {
      showProfileAlert("Please enter your current password.", "error");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showProfileAlert("New password must be at least 6 characters long.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showProfileAlert("New passwords do not match.", "error");
      return;
    }

    const originalText = saveBtn ? saveBtn.innerText : "Update Password";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "Updating...";
    }

    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showProfileAlert(data.error || "Failed to update password.", "error");
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerText = originalText;
        }
        return;
      }

      showProfileAlert("✓ Password updated successfully!", "success");

      if (curPassInput) curPassInput.value = '';
      if (newPassInput) newPassInput.value = '';
      if (confPassInput) confPassInput.value = '';

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
      }

      setTimeout(() => {
        switchProfileView('main');
      }, 1500);

    } catch (err) {
      console.error("Change password error:", err);
      showProfileAlert("Network error while updating password.", "error");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
      }
    }
  }

  // Handle Send Forgot OTP
  async function handleSendForgotOtp(e) {
    if (e) e.preventDefault();
    clearProfileAlert();

    const email = currentUser ? currentUser.email : '';
    if (!email) {
      showProfileAlert("No registered email found for this session.", "error");
      return;
    }

    const btn = document.getElementById('pSendOtpBtn');
    const originalText = btn ? btn.innerText : "Send Verification OTP";
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Sending OTP...";
    }

    try {
      const res = await fetch("/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const text = await res.text();

      if (res.ok && (text.includes("OTP sent") || text.includes("sent successfully"))) {
        showProfileAlert("✓ Verification code sent to " + email + ". Please check your inbox.", "success");
        showForgotStep(2);
        const otpInput = document.getElementById('pForgotOtpInput');
        if (otpInput) {
          otpInput.value = '';
          setTimeout(() => otpInput.focus(), 100);
        }
      } else {
        showProfileAlert(text || "Failed to send OTP.", "error");
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      showProfileAlert("Network error sending OTP.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    }
  }

  // Handle Verify Forgot OTP
  async function handleVerifyForgotOtp(e) {
    if (e) e.preventDefault();
    clearProfileAlert();

    const email = currentUser ? currentUser.email : '';
    const otpInput = document.getElementById('pForgotOtpInput');
    const otp = otpInput ? otpInput.value.trim() : '';

    if (!otp) {
      showProfileAlert("Please enter the 6-digit verification code.", "error");
      return;
    }

    const btn = document.getElementById('pVerifyOtpBtn');
    const originalText = btn ? btn.innerText : "Verify OTP";
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Verifying...";
    }

    try {
      const res = await fetch("/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      const text = await res.text();

      if (res.ok && text.includes("verified")) {
        showProfileAlert("✓ OTP verified successfully! You may now set your new password.", "success");
        showForgotStep(3);
        const newPassInput = document.getElementById('pForgotNewPass');
        if (newPassInput) {
          newPassInput.value = '';
          setTimeout(() => newPassInput.focus(), 100);
        }
      } else {
        showProfileAlert(text || "Invalid or expired OTP code.", "error");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      showProfileAlert("Network error verifying OTP.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = originalText;
      }
    }
  }

  // Handle Submit Forgot Reset Password
  async function handleSubmitForgotReset(e) {
    e.preventDefault();
    clearProfileAlert();

    const email = currentUser ? currentUser.email : '';
    const newPass = document.getElementById('pForgotNewPass');
    const confPass = document.getElementById('pForgotConfirmPass');
    const submitBtn = document.getElementById('pSubmitForgotResetBtn');

    const password = newPass ? newPass.value : '';
    const confirmPassword = confPass ? confPass.value : '';

    if (!password || password.length < 6) {
      showProfileAlert("Password must be at least 6 characters long.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showProfileAlert("Passwords do not match.", "error");
      return;
    }

    const originalText = submitBtn ? submitBtn.innerText : "Set New Password";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Resetting...";
    }

    try {
      const res = await fetch("/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword })
      });
      const text = await res.text();

      if (res.ok && text.includes("successful")) {
        showProfileAlert("✓ Password reset successful! You can now use your new password.", "success");
        if (newPass) newPass.value = '';
        if (confPass) confPass.value = '';
        setTimeout(() => {
          switchProfileView('main');
        }, 1800);
      } else {
        showProfileAlert(text || "Failed to reset password.", "error");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      showProfileAlert("Network error resetting password.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    }
  }

  // ======================================================
  // IN-APP NOTIFICATIONS MANAGER
  // ======================================================

  let notifPollingInterval = null;

  function formatTimeAgo(dateString) {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function fetchUnreadCount() {
    if (!currentUser) return;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return;
      const data = await res.json();
      const count = data.unreadCount || 0;
      updateBadgeUI(count);
    } catch (e) {
      // Quiet fail
    }
  }

  function updateBadgeUI(count) {
    const desktopBadge = document.getElementById("desktopBellBadge");
    const drawerBadge = document.getElementById("drawerNotifBadge");
    const unreadTag = document.getElementById("desktopNotifUnreadTag");

    const displayVal = count > 99 ? "99+" : String(count);

    if (desktopBadge) {
      desktopBadge.innerText = displayVal;
      desktopBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
    if (drawerBadge) {
      drawerBadge.innerText = displayVal;
      drawerBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
    if (unreadTag) {
      unreadTag.innerText = `${count} new`;
    }
  }

  async function loadNotificationFeed() {
    const container = document.getElementById("desktopNotifDropdownBody");
    if (!container) return;

    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        container.innerHTML = `<div class="notif-empty-state"><div class="notif-empty-text">Failed to load notifications</div></div>`;
        return;
      }
      const data = await res.json();
      const list = data.notifications || [];
      console.log("Notifications API response:", data);
      console.log(`Rendering ${list.length} notifications`);

      if (list.length === 0) {
        container.innerHTML = `
          <div class="notif-empty-state">
            <div class="notif-empty-icon">🔔</div>
            <div class="notif-empty-text">No notifications yet.<br>You'll receive alerts when matching items are reported!</div>
          </div>
        `;
        return;
      }

      container.innerHTML = list.map((item) => {
        const isUnread = !item.isRead;
        const timeAgo = formatTimeAgo(item.createdAt);
        const targetUrl = item.targetUrl || item.url || "/items.html";
        const prob = item.matchProbability || item.matchScore || 0;
        const itemName = item.itemName || "";
        const location = item.location || "";
        const date = item.date || "";

        return `
          <div class="notif-item ${isUnread ? 'unread' : 'read'}" data-id="${item._id}" data-url="${escapeHtml(targetUrl)}">
            <div class="notif-item-top">
              <span class="notif-item-dot"></span>
              <span class="notif-item-title">🔔 ${escapeHtml(item.title || "Possible Match Found")}</span>
              <span class="notif-item-time">${timeAgo}</span>
            </div>

            ${itemName ? `<div class="notif-match-name">${escapeHtml(itemName)}</div>` : ''}

            ${(location || date) ? `
              <div class="notif-match-meta">
                ${location ? `<span class="notif-meta-pill">📍 ${escapeHtml(location)}</span>` : ''}
                ${date ? `<span class="notif-meta-pill">📅 ${escapeHtml(date)}</span>` : ''}
              </div>
            ` : ''}

            ${prob > 0 ? `
              <div class="notif-prob-badge">
                <span class="prob-icon">📊</span>
                <span class="prob-label">Matching Probability:</span>
                <span class="prob-val">${prob}%</span>
              </div>
            ` : ''}

            <div class="notif-item-message">${escapeHtml(item.message)}</div>

            <div class="notif-action-row">
              <button type="button" class="notif-check-btn" title="View matching report">Check It Out →</button>
            </div>
          </div>
        `;
      }).join("");

      // Bind click on each notification item and Check It Out button
      container.querySelectorAll(".notif-item").forEach((el) => {
        el.addEventListener("click", async () => {
          const id = el.getAttribute("data-id");
          const targetUrl = el.getAttribute("data-url") || "/items.html";

          // Mark as read in backend
          if (el.classList.contains("unread")) {
            el.classList.remove("unread");
            el.classList.add("read");
            fetch(`/api/notifications/read/${id}`, { method: "POST" })
              .then((r) => r.json())
              .then((d) => updateBadgeUI(d.unreadCount || 0))
              .catch(() => {});
          }

          closeNotificationDropdown();
          window.location.href = targetUrl;
        });
      });
    } catch (err) {
      console.error("[Navbar] Error loading notifications:", err);
      container.innerHTML = `<div class="notif-empty-state"><div class="notif-empty-text">Error loading notifications</div></div>`;
    }
  }

  function toggleNotificationPanel(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("desktopNotifDropdown");
    if (!dropdown) return;

    const isActive = dropdown.classList.toggle("active");
    if (isActive) {
      loadNotificationFeed();
    }
  }

  function closeNotificationDropdown() {
    const dropdown = document.getElementById("desktopNotifDropdown");
    if (dropdown) dropdown.classList.remove("active");
  }

  async function handleMarkAllRead(e) {
    if (e) e.stopPropagation();
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      updateBadgeUI(0);
      document.querySelectorAll(".notif-item.unread").forEach((el) => {
        el.classList.remove("unread");
        el.classList.add("read");
      });
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  }

  function setupNotificationListeners() {
    // Desktop bell button click
    const desktopBtn = document.getElementById("desktopBellBtn");
    if (desktopBtn) {
      desktopBtn.onclick = toggleNotificationPanel;
    }

    // Drawer link click
    const drawerLink = document.getElementById("drawerNotifLink");
    if (drawerLink) {
      drawerLink.onclick = (e) => {
        if (mobileDrawer) {
          mobileDrawer.classList.remove('active');
          if (drawerOverlay) drawerOverlay.classList.remove('active');
          document.body.classList.remove('drawer-open');
        }
        toggleNotificationPanel(e);
      };
    }

    // Mark all read button click
    const markAllBtn = document.getElementById("desktopNotifMarkAllBtn");
    if (markAllBtn) {
      markAllBtn.onclick = handleMarkAllRead;
    }

    // Outside click closes dropdown
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("desktopNotifDropdown");
      const dBtn = document.getElementById("desktopBellBtn");
      const dLink = document.getElementById("drawerNotifLink");

      if (
        dropdown &&
        dropdown.classList.contains("active") &&
        !dropdown.contains(e.target) &&
        (!dBtn || !dBtn.contains(e.target)) &&
        (!dLink || !dLink.contains(e.target))
      ) {
        closeNotificationDropdown();
      }
    });

    // Start polling unread count every 10 seconds and on window focus
    if (notifPollingInterval) clearInterval(notifPollingInterval);
    fetchUnreadCount();
    notifPollingInterval = setInterval(fetchUnreadCount, 10000);
    window.addEventListener('focus', fetchUnreadCount);
  }

  // Setup Drawer actions and gestures
  function setupDrawerEvents() {
    function openDrawer() {
      mobileDrawer.classList.add('active');
      drawerOverlay.classList.add('active');
      document.body.classList.add('drawer-open');
      drawerTrigger.setAttribute('aria-expanded', 'true');
      mobileDrawer.focus();
    }

    function closeDrawer() {
      mobileDrawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
      document.body.classList.remove('drawer-open');
      drawerTrigger.setAttribute('aria-expanded', 'false');
    }

    // Event listeners
    drawerTrigger.addEventListener('click', openDrawer);
    drawerClose.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    // ESC key closes drawer
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('active')) {
        closeDrawer();
      }
    });

    // Touch Swipe to Close Drawer (swipe right)
    let touchStartX = 0;
    mobileDrawer.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mobileDrawer.addEventListener('touchend', function (e) {
      const touchEndX = e.changedTouches[0].screenX;
      // If swiped right by more than 50px
      if (touchEndX - touchStartX > 50) {
        closeDrawer();
      }
    }, { passive: true });

    // Focus Trap inside Drawer
    mobileDrawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;

      const focusables = mobileDrawer.querySelectorAll('button, a, select, [tabindex="0"]');
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) { // Shift + Tab
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    });
  }

  // Reposition Google Translate Widget depending on viewport
  function repositionTranslateWidget() {
    if (!translateElement) return;

    if (window.innerWidth < 992) {
      const mobileTarget = document.getElementById('google_translate_element_mobile_target');
      if (mobileTarget && translateElement.parentElement !== mobileTarget) {
        mobileTarget.appendChild(translateElement);
      }
    } else {
      const desktopTarget = document.getElementById('google_translate_element_desktop_target');
      if (desktopTarget && translateElement.parentElement !== desktopTarget) {
        desktopTarget.appendChild(translateElement);
      }
    }
  }

  // Self initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
  } else {
    initNavbar();
  }
})();
