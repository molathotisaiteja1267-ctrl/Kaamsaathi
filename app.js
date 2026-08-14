// ============================================================================
// KaamSaathi Frontend Application Controller (app.js)
// Production-grade client architecture with zero demo logins,
// unified booking engine, full profile & address management,
// AI support chatbots for customer & partner, and complete admin platform control.
// ============================================================================

(function(root) {
  'use strict';

  // Application State
  const state = {
    currentUser: null,
    currentRole: null, // 'CUSTOMER' | 'PARTNER' | 'ADMIN'
    currentProfile: null,
    services: [],
    partners: [],
    customerBookings: [],
    customerAddresses: [],
    customerPayments: [],
    customerReviews: [],
    customerTickets: [],
    customerNotifications: [],
    adminStats: null,
    adminCustomers: [],
    adminPartners: [],
    adminVerifications: [],
    adminComplaints: [],
    adminTickets: [],
    adminAudits: [],
    signupRole: 'CUSTOMER',
    activeCustomerView: 'cust-overview',
    activePartnerView: 'part-overview',
    activeAdminView: 'adm-overview',
    bookingWizard: {
      step: 1,
      serviceId: null,
      serviceName: '',
      servicePrice: 149,
      partnerId: null,
      addressId: null,
      description: '',
      scheduledDate: 'Today',
      scheduledTime: 'Today · ASAP (15–20 min)',
      paymentMethod: 'UPI'
    },
    custSupportMessages: [
      { sender: 'bot', text: 'Namaste! I am your KaamSaathi AI Assistant. How can I help you with your bookings, payments, or account today?' }
    ],
    partSupportMessages: [
      { sender: 'bot', text: 'Namaste Partner! I am your KaamSaathi Assistant. Ask me anything about job requests, weekly payouts, or verification.' }
    ],
    admAssistantMessages: [
      { sender: 'bot', text: 'Hello Administrator. Ask me any operational query (e.g. "How many bookings completed?", "Show top services", "Check open disputes").' }
    ]
  };

  // Toast System
  function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.style.borderLeftColor = isError ? '#ef4444' : 'var(--lime)';
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  // Modal Control System
  function openModal(modalId) {
    const modal = document.querySelector(modalId);
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    }
    if (backdrop) backdrop.removeAttribute('hidden');
  }

  function closeModal(modalId) {
    const modal = typeof modalId === 'string' ? document.querySelector(modalId) : modalId;
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
    const openModals = document.querySelectorAll('dialog[open]');
    if (openModals.length === 0 && backdrop) {
      backdrop.setAttribute('hidden', '');
    }
  }

  // Check URL routes (/admin/login or /admin)
  function checkUrlRouting() {
    const path = window.location.pathname;
    if (path === '/admin/login') {
      openModal('#admin-login-modal');
    } else if (path === '/admin' && state.currentRole === 'ADMIN') {
      showFullscreenApp('admin-app');
    }
  }

  // Switch Active Dashboard View
  function showFullscreenApp(appId) {
    document.querySelectorAll('.fullscreen-app').forEach(el => el.classList.remove('active'));
    document.getElementById('public-landing').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
    const target = document.getElementById(appId);
    if (target) {
      target.classList.add('active');
    }
  }

  function exitToLanding() {
    document.querySelectorAll('.fullscreen-app').forEach(el => el.classList.remove('active'));
    document.getElementById('public-landing').style.display = 'block';
    document.querySelector('footer').style.display = 'block';
    window.history.pushState({}, '', '/');
  }

  // ==========================================================================
  // INITIALIZATION & SESSION RESTORATION
  // ==========================================================================
  async function initApp() {
    setupEventListeners();
    await loadPublicCatalog();

    // Check if session token exists
    const token = API.getToken();
    if (token) {
      try {
        const authData = await API.getMe();
        if (authData.authenticated && authData.user) {
          state.currentUser = authData.user;
          state.currentRole = authData.user.role;
          state.currentProfile = authData.profile;
          onLoginSuccess(authData);
          return;
        }
      } catch (e) {
        API.setToken(null);
      }
    }

    checkUrlRouting();
  }

  async function loadPublicCatalog() {
    try {
      const srvData = await API.getServices();
      state.services = srvData.services || [];
      renderLandingServices('ALL');

      const partData = await API.getPartners();
      state.partners = partData.partners || [];
      renderLandingPartners();
      renderLandingPackages();
    } catch (err) {
      console.warn('Could not load public catalog:', err);
    }
  }

  function onLoginSuccess(authData) {
    const user = authData.user;
    state.currentUser = user;
    state.currentRole = user.role;
    state.currentProfile = authData.profile || {};

    closeModal('#login-modal');
    closeModal('#signup-modal');
    closeModal('#admin-login-modal');

    if (user.role === 'CUSTOMER') {
      setupCustomerSpace();
    } else if (user.role === 'PARTNER') {
      setupPartnerSpace();
    } else if (user.role === 'ADMIN') {
      setupAdminSpace();
    }
  }

  // ==========================================================================
  // UNIFIED BOOKING ENGINE (Connects every trigger across the app)
  // ==========================================================================
  root.startBooking = async function(serviceIdOrName, partnerId = null) {
    if (!state.currentUser) {
      showToast('Please log in or sign up to book a verified service.');
      openModal('#login-modal');
      return;
    }

    if (state.currentUser.role !== 'CUSTOMER') {
      showToast('You are signed in as a Partner. Please log in as a Customer to book.');
      return;
    }

    // Resolve Service
    let srv = null;
    if (serviceIdOrName) {
      srv = state.services.find(s => s.id === serviceIdOrName || s.name.toLowerCase() === String(serviceIdOrName).toLowerCase());
    }
    if (!srv && state.services.length > 0) {
      srv = state.services[0];
    }

    state.bookingWizard = {
      step: 1,
      serviceId: srv ? srv.id : (state.services[0]?.id || 'srv-1'),
      serviceName: srv ? srv.name : 'Electrician',
      servicePrice: srv ? srv.base_price : 149,
      partnerId: partnerId,
      addressId: state.customerAddresses[0]?.id || null,
      description: '',
      scheduledDate: 'Today',
      scheduledTime: 'Today · ASAP (15–20 min)',
      paymentMethod: 'UPI'
    };

    // Load customer addresses if empty
    if (state.customerAddresses.length === 0) {
      try {
        const addrRes = await API.getAddresses();
        state.customerAddresses = addrRes.addresses || [];
        if (state.customerAddresses.length > 0) {
          state.bookingWizard.addressId = state.customerAddresses[0].id;
        }
      } catch (e) {}
    }

    renderBookingWizardStep();
    openModal('#booking-modal');
  };

  function renderBookingWizardStep() {
    const content = document.getElementById('booking-content');
    const title = document.getElementById('booking-step-title');
    const desc = document.getElementById('booking-step-desc');
    const stepper = document.getElementById('booking-stepper');
    if (!content) return;

    const { step, serviceId, serviceName, servicePrice, partnerId, addressId, description, scheduledTime, paymentMethod } = state.bookingWizard;

    // Update stepper
    if (stepper) {
      const dots = stepper.querySelectorAll('i');
      dots.forEach((dot, idx) => {
        dot.className = idx + 1 === step ? 'active' : (idx + 1 < step ? 'done' : '');
      });
    }

    if (step === 1) {
      title.innerHTML = 'Choose Service<br /><em>&amp; Task Details</em>';
      desc.textContent = 'Step 1 of 3. Pick your service and describe what needs doing.';

      const serviceOptions = state.services.map(s => `
        <option value="${s.id}" ${s.id === serviceId ? 'selected' : ''}>${s.icon} ${s.name} (from ₹${s.base_price})</option>
      `).join('');

      content.innerHTML = `
        <form id="booking-step1-form">
          <div class="form-group">
            <label class="form-label" for="bw-service-select">Select Service</label>
            <select class="form-select" id="bw-service-select" required>
              ${serviceOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="bw-desc-input">Describe Your Requirement / Problem</label>
            <textarea class="form-textarea" id="bw-desc-input" rows="3" placeholder="e.g. Ceiling fan speed regulator is sparking, or need 2 rooms cleaned thoroughly...">${description}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Preferred Time</label>
              <select class="form-select" id="bw-time-select">
                <option value="Today · ASAP (15–20 min)" ${scheduledTime.includes('ASAP') ? 'selected' : ''}>⚡ Today · ASAP (15–20 min)</option>
                <option value="Today · Evening (5:00 PM – 7:00 PM)">Today · Evening (5:00 PM – 7:00 PM)</option>
                <option value="Tomorrow · Morning (9:00 AM – 11:00 AM)">Tomorrow · Morning (9:00 AM – 11:00 AM)</option>
                <option value="Tomorrow · Afternoon (1:00 PM – 3:00 PM)">Tomorrow · Afternoon (1:00 PM – 3:00 PM)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">City Locality</label>
              <input class="form-input" value="Lanka, Varanasi" readonly style="background:#f8faf8" />
            </div>
          </div>
          <button type="submit" class="button" style="width:100%;margin-top:10px">Continue to Address &amp; Partner <span>→</span></button>
        </form>
      `;

      document.getElementById('booking-step1-form').onsubmit = (e) => {
        e.preventDefault();
        const selSrvId = document.getElementById('bw-service-select').value;
        const selectedSrv = state.services.find(s => s.id === selSrvId);
        state.bookingWizard.serviceId = selSrvId;
        state.bookingWizard.serviceName = selectedSrv ? selectedSrv.name : 'Service';
        state.bookingWizard.servicePrice = selectedSrv ? selectedSrv.base_price : 149;
        state.bookingWizard.description = document.getElementById('bw-desc-input').value.trim();
        state.bookingWizard.scheduledTime = document.getElementById('bw-time-select').value;
        state.bookingWizard.step = 2;
        renderBookingWizardStep();
      };
    } else if (step === 2) {
      title.innerHTML = 'Service Address<br /><em>&amp; Partner Match</em>';
      desc.textContent = 'Step 2 of 3. Choose your saved service address and partner preference.';

      let addrListHtml = '';
      if (state.customerAddresses.length > 0) {
        addrListHtml = state.customerAddresses.map((a, idx) => `
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #dce4dc;border-radius:10px;margin-bottom:8px;cursor:pointer;background:${a.id === addressId ? '#f0f7f4' : '#fff'}">
            <input type="radio" name="bw_addr" value="${a.id}" ${a.id === addressId || (!addressId && idx === 0) ? 'checked' : ''} style="margin-top:3px" />
            <div>
              <strong>${a.label} · ${a.locality}</strong>
              <div style="font-size:12px;color:#6b807b">${a.address}, ${a.city} - ${a.pincode}</div>
            </div>
          </label>
        `).join('');
      } else {
        addrListHtml = `
          <div style="padding:14px;background:#fff8eb;border:1px solid #fed7aa;border-radius:10px;font-size:12px;color:#9a3412;margin-bottom:12px">
            No saved address found. Please enter your service address below.
          </div>
          <div class="form-group">
            <label class="form-label">Full Address Line</label>
            <input class="form-input" id="bw-new-addr-line" required placeholder="House / Flat / Street..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Locality</label>
              <input class="form-input" id="bw-new-addr-loc" required value="Lanka" />
            </div>
            <div class="form-group">
              <label class="form-label">PIN Code</label>
              <input class="form-input" id="bw-new-addr-pin" required value="221005" />
            </div>
          </div>
        `;
      }

      content.innerHTML = `
        <form id="booking-step2-form">
          <div class="form-group">
            <label class="form-label">Select Delivery Address</label>
            ${addrListHtml}
            ${state.customerAddresses.length > 0 ? `<button type="button" id="bw-add-new-addr-btn" style="font-size:11px;font-weight:700;color:var(--teal);background:none;border:none;cursor:pointer">+ Add Another Address</button>` : ''}
          </div>

          <div class="form-group" style="margin-top:14px">
            <label class="form-label">Partner Assignment</label>
            <div style="padding:12px;background:#f0f7f4;border:1px solid #c8ded7;border-radius:10px;font-size:12px;color:#244b44">
              ✓ <strong>Auto-Match Nearest Verified Pro</strong> — We will dispatch the highest-rated verified partner in your locality (${scheduledTime}).
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:20px">
            <button type="button" class="button button-ghost" id="bw-back-step1-btn">← Back</button>
            <button type="submit" class="button">Review &amp; Pay <span>→</span></button>
          </div>
        </form>
      `;

      if (document.getElementById('bw-add-new-addr-btn')) {
        document.getElementById('bw-add-new-addr-btn').onclick = () => openModal('#add-address-modal');
      }

      document.getElementById('bw-back-step1-btn').onclick = () => {
        state.bookingWizard.step = 1;
        renderBookingWizardStep();
      };

      document.getElementById('booking-step2-form').onsubmit = async (e) => {
        e.preventDefault();
        const selectedRadio = document.querySelector('input[name="bw_addr"]:checked');
        if (selectedRadio) {
          state.bookingWizard.addressId = selectedRadio.value;
        } else if (state.customerAddresses.length === 0) {
          const addrLine = document.getElementById('bw-new-addr-line').value;
          const loc = document.getElementById('bw-new-addr-loc').value;
          const pin = document.getElementById('bw-new-addr-pin').value;
          try {
            const saveRes = await API.addAddress({ address: addrLine, locality: loc, pincode: pin, label: 'Home' });
            state.bookingWizard.addressId = saveRes.address_id;
          } catch (err) {
            showToast('Failed to save address: ' + err.message, true);
            return;
          }
        }
        state.bookingWizard.step = 3;
        renderBookingWizardStep();
      };
    } else if (step === 3) {
      title.innerHTML = 'Review &amp; Confirm<br /><em>Your Booking</em>';
      desc.textContent = 'Step 3 of 3. Transparent bill breakdown. Booking starts as PENDING until partner confirms.';

      const base = servicePrice;
      const fee = base < 150 ? 15 : 20;
      const tax = Math.round((base + fee) * 0.18);
      const total = base + fee + tax;

      content.innerHTML = `
        <div style="background:#f8faf8;border:1px solid #e1e7df;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong>${serviceName}</strong>
            <b>₹${base}</b>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#667b76;margin-bottom:4px">
            <span>Safety &amp; Platform Fee</span>
            <span>₹${fee}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#667b76;margin-bottom:10px">
            <span>GST Taxes (18%)</span>
            <span>₹${tax}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:var(--teal);border-top:1px dashed #cfd8d4;padding-top:8px">
            <span>Total Payable</span>
            <span>₹${total}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select class="form-select" id="bw-payment-method">
            <option value="UPI" selected>⚡ UPI (GPay, PhonePe, Paytm)</option>
            <option value="Card">💳 Credit / Debit Card / NetBanking (Test Gateway Mode)</option>
            <option value="Cash">💵 Cash After Work Completion</option>
          </select>
          <small style="display:block;color:#7c918c;margin-top:4px">Test Gateway Mode — Sandboxed transaction simulation.</small>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:20px">
          <button type="button" class="button button-ghost" id="bw-back-step2-btn">← Back</button>
          <button type="button" class="button button-lime" id="bw-confirm-booking-btn">Confirm &amp; Place Booking (₹${total}) <span>→</span></button>
        </div>
      `;

      document.getElementById('bw-back-step2-btn').onclick = () => {
        state.bookingWizard.step = 2;
        renderBookingWizardStep();
      };

      document.getElementById('bw-confirm-booking-btn').onclick = async () => {
        const btn = document.getElementById('bw-confirm-booking-btn');
        btn.disabled = true;
        btn.textContent = 'Placing Booking...';

        try {
          const res = await API.createBooking({
            service_id: state.bookingWizard.serviceId,
            partner_id: state.bookingWizard.partnerId,
            address_id: state.bookingWizard.addressId,
            description: state.bookingWizard.description,
            scheduled_date: state.bookingWizard.scheduledDate,
            scheduled_time: state.bookingWizard.scheduledTime,
            payment_method: document.getElementById('bw-payment-method').value
          });

          closeModal('#booking-modal');
          showToast(`Booking Placed! Ref: ${res.booking_reference} (Status: PENDING)`);

          // Refresh Customer Dashboard & Navigate to My Bookings
          if (state.currentRole === 'CUSTOMER') {
            await refreshCustomerData();
            switchCustomerView('cust-bookings');
          }
        } catch (err) {
          showToast('Booking failed: ' + err.message, true);
          btn.disabled = false;
          btn.textContent = 'Confirm & Place Booking →';
        }
      };
    }
  }

  // ==========================================================================
  // CUSTOMER DASHBOARD WORKSPACE
  // ==========================================================================
  async function setupCustomerSpace() {
    showFullscreenApp('customer-app');
    const user = state.currentUser;
    const profile = state.currentProfile || {};

    const nameEl = document.getElementById('cust-name-pill');
    const phoneEl = document.getElementById('cust-phone-pill');
    const avatarEl = document.getElementById('cust-avatar-pill');
    if (nameEl) nameEl.textContent = profile.full_name || user.email;
    if (phoneEl) phoneEl.textContent = user.phone || 'Varanasi Neighbour';
    if (avatarEl) avatarEl.textContent = (profile.full_name || 'C').substring(0, 2).toUpperCase();

    await refreshCustomerData();
    switchCustomerView(state.activeCustomerView || 'cust-overview');
  }

  async function refreshCustomerData() {
    try {
      const [bks, addrs, pays, revs, tkts, notifs] = await Promise.all([
        API.getBookings(),
        API.getAddresses(),
        API.request('/api/bookings'),
        API.getReviews(),
        API.getSupportTickets(),
        API.getNotifications()
      ]);

      state.customerBookings = bks.bookings || [];
      state.customerAddresses = addrs.addresses || [];
      state.customerReviews = revs.reviews || [];
      state.customerTickets = tkts.tickets || [];
      state.customerNotifications = notifs.notifications || [];

      // Update badge counts
      const bBadge = document.getElementById('cust-booking-badge');
      if (bBadge) bBadge.textContent = state.customerBookings.length;

      const unreadNotifs = state.customerNotifications.filter(n => !n.read_status).length;
      const nBadge = document.getElementById('cust-notif-badge');
      const nDot = document.getElementById('cust-header-notif-dot');
      if (nBadge) nBadge.textContent = unreadNotifs;
      if (nDot) nDot.hidden = unreadNotifs === 0;

      // Update address chip in header
      if (state.customerAddresses.length > 0) {
        const def = state.customerAddresses.find(a => a.is_default) || state.customerAddresses[0];
        const chip = document.getElementById('cust-header-addr-text');
        if (chip) chip.textContent = `${def.label} · ${def.locality}`;
      }
    } catch (err) {
      console.warn('Customer data sync warning:', err);
    }
  }

  function switchCustomerView(viewId) {
    state.activeCustomerView = viewId;
    document.querySelectorAll('#customer-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    const main = document.getElementById('customer-main-view');
    if (!main) return;

    if (viewId === 'cust-overview') {
      renderCustomerOverview(main);
    } else if (viewId === 'cust-services') {
      renderCustomerServicesView(main);
    } else if (viewId === 'cust-helper') {
      renderCustomerHelperView(main);
    } else if (viewId === 'cust-bookings') {
      renderCustomerBookingsView(main);
    } else if (viewId === 'cust-payments') {
      renderCustomerPaymentsView(main);
    } else if (viewId === 'cust-addresses') {
      renderCustomerAddressesView(main);
    } else if (viewId === 'cust-reviews') {
      renderCustomerReviewsView(main);
    } else if (viewId === 'cust-notifications') {
      renderCustomerNotificationsView(main);
    } else if (viewId === 'cust-profile') {
      renderCustomerProfileView(main);
    } else if (viewId === 'cust-support') {
      renderCustomerSupportView(main);
    }
  }

  // Customer View: Overview
  function renderCustomerOverview(container) {
    const activeBooking = state.customerBookings.find(b => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status));
    const recentBookings = state.customerBookings.slice(0, 3);

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Namaste, <em>${state.currentProfile?.full_name || 'Neighbour'}!</em></h1>
          <p>What needs doing today? Verified professionals are ready across Varanasi.</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="button" id="dash-quick-book-btn">⚡ Book a Service</button>
          <button class="button button-lime" id="dash-quick-helper-btn">✦ Book a Helper</button>
        </div>
      </div>

      <!-- Quick Action Stat Grid -->
      <div class="stat-grid-4">
        <div class="stat-box">
          <small>Total Bookings</small>
          <strong>${state.customerBookings.length}</strong>
          <span>Recorded in SQLite</span>
        </div>
        <div class="stat-box">
          <small>Active Bookings</small>
          <strong>${state.customerBookings.filter(b => !['COMPLETED', 'CANCELLED'].includes(b.status)).length}</strong>
          <span>In real-time progress</span>
        </div>
        <div class="stat-box">
          <small>Saved Addresses</small>
          <strong>${state.customerAddresses.length}</strong>
          <span>Varanasi locations</span>
        </div>
        <div class="stat-box">
          <small>Support Inquiries</small>
          <strong>${state.customerTickets.length}</strong>
          <span>Active tickets</span>
        </div>
      </div>

      <!-- Active Booking Tracker Banner if available -->
      ${activeBooking ? `
        <div class="active-booking-banner">
          <div class="active-booking-top">
            <small>LIVE BOOKING TRACKER</small>
            <span class="booking-ref-tag">${activeBooking.booking_reference}</span>
          </div>
          <div class="active-booking-info">
            <div style="font-size:32px">${activeBooking.service_icon || '⚡'}</div>
            <div>
              <h4>${activeBooking.service_name}</h4>
              <p>Status: <strong>${activeBooking.status.replace('_', ' ')}</strong> · Assigned Pro: ${activeBooking.partner_name || 'Matching pro nearby'}</p>
            </div>
          </div>
          <div class="booking-tracker-steps">
            <div class="tracker-node done"><i>✓</i><span>Pending</span></div>
            <div class="tracker-node ${activeBooking.status !== 'PENDING' ? 'done' : 'current'}"><i>${activeBooking.status !== 'PENDING' ? '✓' : '2'}</i><span>Accepted</span></div>
            <div class="tracker-node ${['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(activeBooking.status) ? 'done' : ''}"><i>3</i><span>On Way</span></div>
            <div class="tracker-node ${['IN_PROGRESS', 'COMPLETED'].includes(activeBooking.status) ? 'done' : ''}"><i>4</i><span>In Progress</span></div>
            <div class="tracker-node ${activeBooking.status === 'COMPLETED' ? 'done' : ''}"><i>5</i><span>Done</span></div>
          </div>
        </div>
      ` : ''}

      <!-- Popular Services Near You Cards -->
      <div class="profile-section-card">
        <h3>Popular Services Near You</h3>
        <div class="service-grid" style="grid-template-columns:repeat(3, 1fr)">
          ${state.services.slice(0, 6).map(s => `
            <div class="service-card" style="min-height:180px">
              <div class="service-icon" style="background:${s.color}">${s.icon}</div>
              <h3>${s.name}</h3>
              <p>${s.description}</p>
              <div class="service-bottom">
                <b>₹${s.base_price}</b>
                <button class="button button-small" onclick="startBooking('${s.id}')">Book Now →</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('dash-quick-book-btn').onclick = () => switchCustomerView('cust-services');
    document.getElementById('dash-quick-helper-btn').onclick = () => switchCustomerView('cust-helper');
  }

  // Customer View: All Services Catalog (69 Services)
  function renderCustomerServicesView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Book a <em>Service</em></h1>
          <p>Choose from our complete catalog of 69 verified domestic services in Varanasi.</p>
        </div>
      </div>

      <div class="quick-search" style="max-width:100%;margin-bottom:20px">
        <span class="search-icon">⌕</span>
        <input id="catalog-inner-search" placeholder="Search any service (e.g. AC repair, cooler, water tank, sofa cleaning...)" />
      </div>

      <div class="service-grid" id="catalog-inner-grid">
        ${state.services.map(s => `
          <div class="service-card">
            <div class="service-icon" style="background:${s.color}">${s.icon}</div>
            <h3>${s.name}</h3>
            <p>${s.description}</p>
            <div class="service-bottom">
              <b>₹${s.base_price}</b>
              <button class="button button-small" onclick="startBooking('${s.id}')">Book Now →</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const searchInput = document.getElementById('catalog-inner-search');
    if (searchInput) {
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase();
        const filtered = state.services.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query));
        const grid = document.getElementById('catalog-inner-grid');
        if (grid) {
          grid.innerHTML = filtered.map(s => `
            <div class="service-card">
              <div class="service-icon" style="background:${s.color}">${s.icon}</div>
              <h3>${s.name}</h3>
              <p>${s.description}</p>
              <div class="service-bottom">
                <b>₹${s.base_price}</b>
                <button class="button button-small" onclick="startBooking('${s.id}')">Book Now →</button>
              </div>
            </div>
          `).join('');
        }
      };
    }
  }

  // Customer View: Book a Helper
  function renderCustomerHelperView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Book a <em>Helper</em></h1>
          <p>Tell us what you need. We'll bundle your tasks or dispatch an all-rounder helper.</p>
        </div>
      </div>

      <div class="profile-section-card" style="background:linear-gradient(135deg,#134e52,#195b60);color:white">
        <h3 style="color:var(--lime)">✦ MULTI-TASK HELPER ENGINE</h3>
        <p style="color:#d4e9e4;font-size:13px;margin-bottom:16px">Describe multi-step tasks like room shifting, cleaning, furniture assembly, or carrying boxes. We detect all jobs and compute a single discounted helper package.</p>
        
        <textarea id="helper-view-input" rows="3" class="form-textarea" style="background:rgba(255,255,255,0.95);color:#1b3935;font-size:14px" placeholder="e.g. I need someone to clean my room, assemble my study table, and carry boxes upstairs."></textarea>
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <span style="font-size:11px;color:#c0dfd0;margin-right:4px">Popular:</span>
            <button class="chat-action-chip" onclick="document.getElementById('helper-view-input').value = 'Moving Help: carry luggage & boxes to new flat';">Moving Help</button>
            <button class="chat-action-chip" onclick="document.getElementById('helper-view-input').value = 'Room Deep Cleaning + Assemble study table';">Cleaning + Assembly</button>
            <button class="chat-action-chip" onclick="document.getElementById('helper-view-input').value = 'Event Helper: assist with chairs and food serving';">Event Helper</button>
            <button class="chat-action-chip" onclick="document.getElementById('helper-view-input').value = 'Doorstep Errand & grocery pickup run';">Errand Help</button>
          </div>
          <button class="button button-lime" id="helper-view-find-btn">Find a Helper <span>→</span></button>
        </div>

        <div id="helper-view-result" style="margin-top:16px;display:none;background:rgba(255,255,255,0.15);padding:14px;border-radius:10px"></div>
      </div>
    `;

    document.getElementById('helper-view-find-btn').onclick = () => {
      const text = document.getElementById('helper-view-input').value.trim();
      const res = NLP.analyzeCompoundRequest(text);
      const resDiv = document.getElementById('helper-view-result');
      resDiv.style.display = 'block';
      resDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${res.summary}</strong>
            <div style="font-size:12px;color:#eaf5ea">Tasks: ${res.detectedServices.join(', ')}</div>
          </div>
          <button class="button button-lime" onclick="startBooking('Book a Helper')">Book Helper Bundle (₹${res.packagePrice}) →</button>
        </div>
      `;
    };
  }

  // Customer View: My Bookings
  function renderCustomerBookingsView(container) {
    const list = state.customerBookings;

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>My <em>Bookings</em></h1>
          <p>View and track your active, upcoming, and past service orders.</p>
        </div>
        <button class="button" id="my-bookings-new-btn">+ New Booking</button>
      </div>

      ${list.length === 0 ? `
        <div class="profile-section-card" style="text-align:center;padding:48px 20px">
          <div style="font-size:40px;margin-bottom:10px">📦</div>
          <h3>No bookings yet</h3>
          <p style="color:#788d87;max-width:340px;margin:0 auto 20px">Book your first verified professional or helper in Varanasi with 1 click.</p>
          <button class="button" onclick="switchCustomerView('cust-services')">Book a Service Now →</button>
        </div>
      ` : `
        <div class="profile-section-card" style="padding:0;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
                <th style="padding:14px 18px">Reference</th>
                <th style="padding:14px 18px">Service</th>
                <th style="padding:14px 18px">Partner</th>
                <th style="padding:14px 18px">Scheduled</th>
                <th style="padding:14px 18px">Amount</th>
                <th style="padding:14px 18px">Status</th>
                <th style="padding:14px 18px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(b => `
                <tr style="border-bottom:1px solid #f0f4f1">
                  <td style="padding:14px 18px"><strong>${b.booking_reference}</strong></td>
                  <td style="padding:14px 18px">${b.service_icon || '⚡'} ${b.service_name}</td>
                  <td style="padding:14px 18px">${b.partner_name || '<span style="color:#94a3b8">Pending Assignment</span>'}</td>
                  <td style="padding:14px 18px">${b.scheduled_time}</td>
                  <td style="padding:14px 18px"><b>₹${b.total_amount}</b></td>
                  <td style="padding:14px 18px"><span class="status-pill ${b.status.toLowerCase()}">${b.status.replace('_', ' ')}</span></td>
                  <td style="padding:14px 18px">
                    ${b.status === 'COMPLETED' ? `
                      <button class="button button-small" style="font-size:11px" onclick="openReviewModal('${b.id}', '${b.booking_reference}')">Rate Pro ★</button>
                    ` : (b.status === 'PENDING' || b.status === 'ACCEPTED' ? `
                      <button class="button button-small button-danger" style="font-size:11px" onclick="cancelBooking('${b.id}')">Cancel</button>
                    ` : `<button class="button button-small button-ghost" style="font-size:11px" onclick="openComplaintModal('${b.id}')">Report</button>`)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    document.getElementById('my-bookings-new-btn').onclick = () => startBooking();
  }

  // Customer View: Payments
  function renderCustomerPaymentsView(container) {
    const list = state.customerBookings;

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Payment <em>History</em></h1>
          <p>Transparent invoices and payment transaction records.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Booking Reference</th>
              <th style="padding:14px 18px">Service</th>
              <th style="padding:14px 18px">Amount</th>
              <th style="padding:14px 18px">Date</th>
              <th style="padding:14px 18px">Payment Status</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="5" style="padding:30px;text-align:center;color:#889c97">No payment history recorded yet.</td></tr>` : list.map(b => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${b.booking_reference}</strong></td>
                <td style="padding:14px 18px">${b.service_name}</td>
                <td style="padding:14px 18px"><b>₹${b.total_amount}</b></td>
                <td style="padding:14px 18px">${new Date(b.created_at).toLocaleDateString()}</td>
                <td style="padding:14px 18px"><span class="status-pill ${b.status === 'COMPLETED' ? 'verified' : 'pending'}">${b.status === 'COMPLETED' ? 'PAID' : 'PENDING'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Customer View: Saved Addresses
  function renderCustomerAddressesView(container) {
    const addrs = state.customerAddresses;

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Saved <em>Addresses</em></h1>
          <p>Manage your home, hostel, or office locations in Varanasi.</p>
        </div>
        <button class="button" id="addr-view-add-btn">+ Add New Address</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:16px">
        ${addrs.length === 0 ? `<div class="profile-section-card" style="grid-column:span 2;text-align:center;padding:30px">No saved addresses. Click "+ Add New Address" above.</div>` : addrs.map(a => `
          <div class="profile-section-card" style="margin:0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <h3>${a.label === 'Home' ? '🏠' : (a.label === 'Work' ? '💼' : '📍')} ${a.label} ${a.is_default ? '<span class="status-pill verified">DEFAULT</span>' : ''}</h3>
              <div style="display:flex;gap:6px">
                ${!a.is_default ? `<button class="button button-small button-ghost" style="font-size:11px" onclick="setDefaultAddress('${a.id}')">Set Default</button>` : ''}
                <button class="button button-small button-danger" style="font-size:11px" onclick="deleteAddress('${a.id}')">Delete</button>
              </div>
            </div>
            <p style="font-size:13px;color:#49615d;margin:8px 0">${a.address}</p>
            <div style="font-size:12px;color:#7e928e">${a.locality}, ${a.city} · PIN: ${a.pincode}</div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('addr-view-add-btn').onclick = () => openModal('#add-address-modal');
  }

  // Customer View: Customer Profile & Security
  function renderCustomerProfileView(container) {
    const user = state.currentUser;
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Customer <em>Profile</em></h1>
          <p>Personal information, security credentials, and account settings.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Personal Information <button class="button button-small button-ghost" id="open-edit-profile-btn">Edit Profile ✎</button></h3>
        <div class="profile-data-row"><span>Full Name</span><strong>${profile.full_name || 'User'}</strong></div>
        <div class="profile-data-row"><span>Email Address</span><strong>${user.email}</strong></div>
        <div class="profile-data-row"><span>Phone Number</span><strong>${user.phone || 'Not provided'}</strong></div>
        <div class="profile-data-row"><span>Preferred Language</span><strong>${profile.preferred_language || 'Hindi'}</strong></div>
        <div class="profile-data-row"><span>Bio / Note</span><strong>${profile.bio || 'None'}</strong></div>
        <div class="profile-data-row"><span>Account Status</span><strong style="color:#15803d">ACTIVE</strong></div>
      </div>

      <div class="profile-section-card">
        <h3>Account Security &amp; Login</h3>
        <div class="profile-data-row">
          <span>Password</span>
          <button class="button button-small button-ghost" id="open-change-pass-btn">Change Password 🔒</button>
        </div>
        <div class="profile-data-row">
          <span>Session Authentication</span>
          <button class="button button-small button-ghost" id="cust-profile-logout-btn">Log Out All Sessions 🚪</button>
        </div>
      </div>

      <div class="profile-section-card" style="border-color:#fecaca;background:#fff5f5">
        <h3 style="color:#b91c1c">Danger Zone</h3>
        <p style="font-size:12px;color:#991b1b;margin-bottom:12px">Deactivating your account will remove your active sessions and archive past data.</p>
        <button class="button button-danger" id="open-delete-account-btn">Delete Account Forever ⚠</button>
      </div>
    `;

    document.getElementById('open-edit-profile-btn').onclick = () => {
      document.getElementById('edit-profile-name').value = profile.full_name || '';
      document.getElementById('edit-profile-phone').value = user.phone || '';
      document.getElementById('edit-profile-lang').value = profile.preferred_language || 'Hindi';
      document.getElementById('edit-profile-bio').value = profile.bio || '';
      openModal('#edit-profile-modal');
    };

    document.getElementById('open-change-pass-btn').onclick = () => openModal('#change-password-modal');
    document.getElementById('open-delete-account-btn').onclick = () => openModal('#delete-account-modal');
    document.getElementById('cust-profile-logout-btn').onclick = () => handleLogout();
  }

  // Customer View: Help & Support with AI Chatbot
  function renderCustomerSupportView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Help &amp; <em>Support Center</em></h1>
          <p>Ask our KaamSaathi AI Assistant or submit a formal support request.</p>
        </div>
        <button class="button" id="create-support-ticket-btn">+ Create Support Request</button>
      </div>

      <div class="support-chat-container">
        <!-- AI Chatbot Box -->
        <div class="support-chat-box">
          <div class="support-chat-header">
            <strong>✦ KAAMSAATHI ASSISTANT</strong>
            <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:100px">Active AI</span>
          </div>
          <div class="support-chat-messages" id="cust-support-messages-list">
            ${state.custSupportMessages.map(m => `
              <div class="chat-bubble ${m.sender}">
                ${m.text}
                ${m.actions ? `<div class="chat-action-btn-row">${m.actions.map(a => `<button class="chat-action-chip" onclick="${a.view ? `switchCustomerView('${a.view}')` : (a.triggerModal ? `openModal('${a.triggerModal}')` : '')}">${a.label}</button>`).join('')}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="support-chat-input-bar">
            <input id="cust-support-input" placeholder="Ask about bookings, cancellations, refunds, pro verification..." />
            <button class="button button-small" id="cust-support-send-btn">Send <span>→</span></button>
          </div>
        </div>

        <!-- Support Tickets List -->
        <div class="profile-section-card" style="margin:0">
          <h3>Your Support Tickets</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${state.customerTickets.length === 0 ? `<p style="font-size:12px;color:#80948f">No open support tickets. Click "+ Create Support Request" above if you need help.</p>` : state.customerTickets.map(t => `
              <div style="padding:10px;border:1px solid #e1e7df;border-radius:10px;font-size:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <strong>${t.ticket_reference}</strong>
                  <span class="ticket-row-badge ${t.status.toLowerCase()}">${t.status}</span>
                </div>
                <div style="color:#506a65;margin-bottom:4px">${t.description}</div>
                ${t.admin_response ? `<div style="background:#eef6f3;padding:6px;border-radius:6px;color:#18534c"><strong>Admin Response:</strong> ${t.admin_response}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('create-support-ticket-btn').onclick = () => openModal('#create-ticket-modal');

    const sendBtn = document.getElementById('cust-support-send-btn');
    const input = document.getElementById('cust-support-input');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      state.custSupportMessages.push({ sender: 'user', text: q });
      const res = NLP.processCustomerSupportDialogue([], q, state.customerBookings);
      state.custSupportMessages.push({ sender: 'bot', text: res.reply, actions: res.actions });
      input.value = '';
      renderCustomerSupportView(container);
    };

    sendBtn.onclick = handleSend;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
  }

  // Customer Reviews View
  function renderCustomerReviewsView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Service <em>Reviews</em></h1>
          <p>Your ratings and feedback for completed services.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Reviews Submitted (${state.customerReviews.length})</h3>
        ${state.customerReviews.length === 0 ? `<p style="color:#7f948f;font-size:13px">You haven't reviewed any completed bookings yet.</p>` : state.customerReviews.map(r => `
          <div style="padding:12px 0;border-bottom:1px solid #f0f4f1">
            <div style="display:flex;justify-content:space-between">
              <strong>${r.service_name} · Partner: ${r.partner_name}</strong>
              <span style="color:#f59e0b">★ ${r.rating} / 5</span>
            </div>
            <p style="font-size:13px;color:#49615c;margin:6px 0">${r.comment || 'No written comment.'}</p>
            <small style="color:#94a3a0">${new Date(r.created_at).toLocaleDateString()}</small>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Customer Notifications View
  function renderCustomerNotificationsView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Notifications</h1>
          <p>Real-time booking and platform updates.</p>
        </div>
        <button class="button button-small button-ghost" id="mark-notifs-read-btn">Mark All as Read</button>
      </div>

      <div class="profile-section-card">
        ${state.customerNotifications.length === 0 ? `<p style="color:#7f948f;font-size:13px">No notifications.</p>` : state.customerNotifications.map(n => `
          <div style="padding:12px 0;border-bottom:1px solid #f0f4f1;display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:18px">${n.type === 'booking' ? '📦' : '✦'}</span>
            <div>
              <strong>${n.title}</strong>
              <p style="font-size:13px;color:#49615c;margin:4px 0">${n.message}</p>
              <small style="color:#94a3a0">${new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('mark-notifs-read-btn').onclick = async () => {
      await API.markNotificationsRead();
      await refreshCustomerData();
      renderCustomerNotificationsView(container);
    };
  }

  // Address Actions
  root.deleteAddress = async function(id) {
    try {
      await API.deleteAddress(id);
      showToast('Address deleted.');
      await refreshCustomerData();
      switchCustomerView('cust-addresses');
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.setDefaultAddress = async function(id) {
    try {
      await API.setDefaultAddress(id);
      showToast('Default address set.');
      await refreshCustomerData();
      switchCustomerView('cust-addresses');
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // Booking Cancel & Review
  root.cancelBooking = async function(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await API.updateBookingStatus(id, 'CANCELLED');
      showToast('Booking cancelled.');
      await refreshCustomerData();
      switchCustomerView('cust-bookings');
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.openReviewModal = function(bookingId, ref) {
    document.getElementById('review-booking-id').value = bookingId;
    document.getElementById('review-booking-ref-label').textContent = `Booking: ${ref}`;
    openModal('#review-modal');
  };

  root.openComplaintModal = function(bookingId) {
    document.getElementById('complaint-booking-id').value = bookingId;
    openModal('#complaint-modal');
  };

  // ==========================================================================
  // PARTNER DASHBOARD WORKSPACE
  // ==========================================================================
  async function setupPartnerSpace() {
    showFullscreenApp('partner-app');
    const user = state.currentUser;
    const profile = state.currentProfile || {};

    const nameEl = document.getElementById('part-name-pill');
    const areaEl = document.getElementById('part-area-pill');
    const avatarEl = document.getElementById('part-avatar-pill');
    const kycBadge = document.getElementById('part-kyc-status-badge');

    if (nameEl) nameEl.textContent = profile.full_name || user.email;
    if (areaEl) areaEl.textContent = `${profile.service_locality || 'Lanka'}, Varanasi`;
    if (avatarEl) avatarEl.textContent = profile.initials || 'KP';
    if (kycBadge) {
      kycBadge.textContent = profile.verification_status === 'VERIFIED' ? '✓ VERIFIED PRO' : '🟡 VERIFICATION PENDING';
      kycBadge.className = `status-pill ${profile.verification_status === 'VERIFIED' ? 'verified' : 'pending'}`;
    }

    await refreshPartnerData();
    switchPartnerView(state.activePartnerView || 'part-overview');
  }

  async function refreshPartnerData() {
    try {
      const bks = await API.getBookings();
      state.partnerBookings = bks.bookings || [];

      const reqCount = state.partnerBookings.filter(b => b.status === 'PENDING').length;
      const actCount = state.partnerBookings.filter(b => ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status)).length;

      const reqBadge = document.getElementById('part-req-badge');
      const actBadge = document.getElementById('part-active-badge');
      if (reqBadge) reqBadge.textContent = reqCount;
      if (actBadge) actBadge.textContent = actCount;
    } catch (e) {
      console.warn('Partner data sync warning:', e);
    }
  }

  function switchPartnerView(viewId) {
    state.activePartnerView = viewId;
    document.querySelectorAll('#partner-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    const main = document.getElementById('partner-main-view');
    if (!main) return;

    if (viewId === 'part-overview' || viewId === 'part-requests') {
      renderPartnerOverview(main);
    } else if (viewId === 'part-support') {
      renderPartnerSupportView(main);
    } else if (viewId === 'part-profile') {
      renderPartnerProfileView(main);
    } else {
      renderPartnerOverview(main);
    }
  }

  function renderPartnerOverview(container) {
    const list = state.partnerBookings || [];
    const pendingReqs = list.filter(b => b.status === 'PENDING');
    const activeJobs = list.filter(b => ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status));
    const completedJobs = list.filter(b => b.status === 'COMPLETED');
    const earnings = completedJobs.reduce((sum, b) => sum + (b.estimated_price || 149), 0);

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner Workspace — <em>${state.currentProfile?.full_name || 'Partner'}</em></h1>
          <p>Manage incoming customer requests, milestone progress, and earnings.</p>
        </div>
      </div>

      <div class="stat-grid-4">
        <div class="stat-box">
          <small>Incoming Requests</small>
          <strong>${pendingReqs.length}</strong>
          <span>Awaiting acceptance</span>
        </div>
        <div class="stat-box">
          <small>Active Jobs</small>
          <strong>${activeJobs.length}</strong>
          <span>In progress</span>
        </div>
        <div class="stat-box">
          <small>Completed Jobs</small>
          <strong>${completedJobs.length}</strong>
          <span>Lifetime</span>
        </div>
        <div class="stat-box">
          <small>Total Earnings</small>
          <strong>₹${earnings}</strong>
          <span>Direct payout</span>
        </div>
      </div>

      <!-- Incoming Requests Section -->
      <div class="profile-section-card">
        <h3>Incoming Requests (${pendingReqs.length})</h3>
        ${pendingReqs.length === 0 ? `<p style="color:#788f89;font-size:13px">No pending booking requests right now.</p>` : pendingReqs.map(b => `
          <div style="background:#f8faf8;border:1px solid #e1e7df;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span class="booking-ref-tag">${b.booking_reference}</span>
              <h4 style="margin:6px 0 2px">${b.service_name}</h4>
              <p style="font-size:13px;color:#5a736e;margin:0">Customer: <strong>${b.customer_name}</strong> · ${b.customer_locality || 'Lanka'}</p>
              <small style="color:#80948f">${b.scheduled_time} · Payout: <b>₹${b.estimated_price}</b></small>
            </div>
            <div style="display:flex;gap:8px">
              <button class="button button-small button-lime" onclick="acceptBooking('${b.id}')">Accept ✓</button>
              <button class="button button-small button-ghost" onclick="rejectBooking('${b.id}')">Decline ×</button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Active Jobs Progress Tracker -->
      <div class="profile-section-card">
        <h3>Active Jobs (${activeJobs.length})</h3>
        ${activeJobs.length === 0 ? `<p style="color:#788f89;font-size:13px">No active jobs. Accepted requests will appear here for milestone updates.</p>` : activeJobs.map(b => `
          <div style="border:1px solid #cce1da;background:#f2f8f5;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between">
              <strong>${b.service_name} · ${b.booking_reference}</strong>
              <span class="status-pill accepted">${b.status}</span>
            </div>
            <p style="font-size:13px;margin:8px 0">Customer: ${b.customer_name} · Address: ${b.customer_address || 'Lanka Main Road'}</p>
            <div style="display:flex;gap:8px;margin-top:12px">
              ${b.status === 'ACCEPTED' ? `<button class="button button-small" onclick="advanceJobStatus('${b.id}', 'ON_THE_WAY')">I'm On The Way →</button>` : ''}
              ${b.status === 'ON_THE_WAY' ? `<button class="button button-small" onclick="advanceJobStatus('${b.id}', 'ARRIVED')">I Have Arrived 📍</button>` : ''}
              ${b.status === 'ARRIVED' ? `<button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'IN_PROGRESS')">Start Service ⚒</button>` : ''}
              ${b.status === 'IN_PROGRESS' ? `<button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'COMPLETED')">Complete Service ✓</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderPartnerSupportView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner <em>Support Assistant</em></h1>
          <p>Ask questions about jobs, earnings, availability, or KYC verification.</p>
        </div>
      </div>

      <div class="support-chat-container">
        <div class="support-chat-box">
          <div class="support-chat-header">
            <strong>✦ PARTNER AI ASSISTANT</strong>
            <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:100px">Partner AI</span>
          </div>
          <div class="support-chat-messages" id="part-support-messages-list">
            ${state.partSupportMessages.map(m => `
              <div class="chat-bubble ${m.sender}">
                ${m.text}
                ${m.actions ? `<div class="chat-action-btn-row">${m.actions.map(a => `<button class="chat-action-chip" onclick="switchPartnerView('${a.view}')">${a.label}</button>`).join('')}</div>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="support-chat-input-bar">
            <input id="part-support-input" placeholder="Ask about bookings, weekly earnings, verification status..." />
            <button class="button button-small" id="part-support-send-btn">Send <span>→</span></button>
          </div>
        </div>

        <div class="profile-section-card" style="margin:0">
          <h3>Partner Help Guidelines</h3>
          <p style="font-size:13px;line-height:1.5;color:#546e68">
            • <strong>Accepting Bookings:</strong> Review customer distance and task requirement before accepting.<br /><br />
            • <strong>Milestone Status:</strong> Always click "On The Way" and "Arrived" so the customer is notified in real time.<br /><br />
            • <strong>Weekly Payouts:</strong> Earnings for all completed jobs are transferred every Monday directly to your registered bank account.
          </p>
        </div>
      </div>
    `;

    const sendBtn = document.getElementById('part-support-send-btn');
    const input = document.getElementById('part-support-input');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      state.partSupportMessages.push({ sender: 'user', text: q });
      const res = NLP.processPartnerSupportDialogue([], q);
      state.partSupportMessages.push({ sender: 'bot', text: res.reply, actions: res.actions });
      input.value = '';
      renderPartnerSupportView(container);
    };

    sendBtn.onclick = handleSend;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
  }

  function renderPartnerProfileView(container) {
    const user = state.currentUser;
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner <em>Profile</em></h1>
          <p>Professional trade credentials, service locality, and verification details.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Professional Information</h3>
        <div class="profile-data-row"><span>Full Name</span><strong>${profile.full_name || 'Partner'}</strong></div>
        <div class="profile-data-row"><span>Email</span><strong>${user.email}</strong></div>
        <div class="profile-data-row"><span>Service Locality</span><strong>${profile.service_locality || 'Lanka'}, Varanasi (${profile.service_radius || '5 km'})</strong></div>
        <div class="profile-data-row"><span>Experience</span><strong>${profile.experience_years || 1} Years</strong></div>
        <div class="profile-data-row"><span>Customer Rating</span><strong>★ ${profile.rating || 5.0} (${profile.rating_count || 0} reviews)</strong></div>
        <div class="profile-data-row"><span>Verification Status</span><strong class="status-pill ${profile.verification_status === 'VERIFIED' ? 'verified' : 'pending'}">${profile.verification_status}</strong></div>
      </div>
    `;
  }

  // Partner Booking Actions
  root.acceptBooking = async function(id) {
    try {
      await API.acceptBooking(id);
      showToast('Booking accepted! You can now advance its status.');
      await refreshPartnerData();
      renderPartnerOverview(document.getElementById('partner-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.rejectBooking = async function(id) {
    try {
      await API.rejectBooking(id);
      showToast('Booking declined.');
      await refreshPartnerData();
      renderPartnerOverview(document.getElementById('partner-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.advanceJobStatus = async function(id, nextStatus) {
    try {
      await API.updateBookingStatus(id, nextStatus);
      showToast(`Status updated to ${nextStatus.replace('_', ' ')}.`);
      await refreshPartnerData();
      renderPartnerOverview(document.getElementById('partner-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // ==========================================================================
  // ADMINISTRATOR DASHBOARD WORKSPACE
  // ==========================================================================
  async function setupAdminSpace() {
    showFullscreenApp('admin-app');
    await refreshAdminData();
    switchAdminView(state.activeAdminView || 'adm-overview');
  }

  async function refreshAdminData() {
    try {
      const [stats, custs, parts, vers, cmps, tkts, audits] = await Promise.all([
        API.getAdminStats(),
        API.getAdminCustomers(),
        API.getAdminPartners(),
        API.getAdminVerifications(),
        API.getAdminComplaints(),
        API.getAdminSupportTickets(),
        API.getAdminAuditLogs()
      ]);

      state.adminStats = stats;
      state.adminCustomers = custs.customers || [];
      state.adminPartners = parts.partners || [];
      state.adminVerifications = vers.verifications || [];
      state.adminComplaints = cmps.complaints || [];
      state.adminTickets = tkts.tickets || [];
      state.adminAudits = audits.audit_logs || [];

      const kycB = document.getElementById('adm-kyc-badge');
      const cmpB = document.getElementById('adm-complaints-badge');
      const tktB = document.getElementById('adm-tickets-badge');
      if (kycB) kycB.textContent = stats.pending_verifications || 0;
      if (cmpB) cmpB.textContent = stats.open_complaints || 0;
      if (tktB) tktB.textContent = stats.open_support_tickets || 0;
    } catch (e) {
      console.warn('Admin data sync warning:', e);
    }
  }

  function switchAdminView(viewId) {
    state.activeAdminView = viewId;
    document.querySelectorAll('#admin-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewId);
    });

    const main = document.getElementById('admin-main-view');
    if (!main) return;

    if (viewId === 'adm-overview') {
      renderAdminOverview(main);
    } else if (viewId === 'adm-customers') {
      renderAdminCustomers(main);
    } else if (viewId === 'adm-partners') {
      renderAdminPartners(main);
    } else if (viewId === 'adm-kyc') {
      renderAdminKYC(main);
    } else if (viewId === 'adm-services') {
      renderAdminServices(main);
    } else if (viewId === 'adm-complaints') {
      renderAdminComplaints(main);
    } else if (viewId === 'adm-support-tickets') {
      renderAdminSupportTickets(main);
    } else if (viewId === 'adm-assistant') {
      renderAdminAssistant(main);
    } else if (viewId === 'adm-audits') {
      renderAdminAudits(main);
    } else {
      renderAdminOverview(main);
    }
  }

  function renderAdminOverview(container) {
    const s = state.adminStats || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Administrator <em>Platform Overview</em></h1>
          <p>Real-time database metrics computed via pure SQLite aggregation queries.</p>
        </div>
      </div>

      <div class="stat-grid-4">
        <div class="stat-box">
          <small>Total Customers</small>
          <strong>${s.total_customers ?? 0}</strong>
          <span>Live SQLite records</span>
        </div>
        <div class="stat-box">
          <small>Total Partners</small>
          <strong>${s.total_partners ?? 0}</strong>
          <span>${s.verified_partners ?? 0} verified · ${s.pending_partners ?? 0} pending</span>
        </div>
        <div class="stat-box">
          <small>Total Bookings</small>
          <strong>${s.total_bookings ?? 0}</strong>
          <span>${s.pending_bookings ?? 0} pending · ${s.completed_bookings ?? 0} completed</span>
        </div>
        <div class="stat-box">
          <small>Platform Revenue</small>
          <strong>₹${s.total_revenue ?? 0}</strong>
          <span>Paid transactions</span>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Popular Services in Varanasi</h3>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px">
          ${(s.popular_services || []).map(p => `
            <div style="padding:14px;border:1px solid #e1e7df;border-radius:10px;background:#f8faf8">
              <strong>${p.name}</strong>
              <div style="font-size:12px;color:#67817c;margin-top:4px">${p.booking_count} total bookings placed</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderAdminCustomers(container) {
    const list = state.adminCustomers || [];

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Customer <em>Management</em></h1>
          <p>Inspect registered customer profiles and account status.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Customer Name</th>
              <th style="padding:14px 18px">Email</th>
              <th style="padding:14px 18px">Phone</th>
              <th style="padding:14px 18px">Bookings</th>
              <th style="padding:14px 18px">Status</th>
              <th style="padding:14px 18px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:#889c97">0 customers registered in SQLite.</td></tr>` : list.map(c => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${c.full_name}</strong></td>
                <td style="padding:14px 18px">${c.email}</td>
                <td style="padding:14px 18px">${c.phone || '—'}</td>
                <td style="padding:14px 18px">${c.total_bookings}</td>
                <td style="padding:14px 18px"><span class="status-pill ${c.account_status === 'ACTIVE' ? 'verified' : 'cancelled'}">${c.account_status}</span></td>
                <td style="padding:14px 18px">
                  ${c.account_status === 'ACTIVE' ? `
                    <button class="button button-small button-danger" style="font-size:11px" onclick="setCustomerStatus('${c.id}', 'SUSPENDED')">Suspend</button>
                  ` : `
                    <button class="button button-small" style="font-size:11px" onclick="setCustomerStatus('${c.id}', 'ACTIVE')">Reactivate</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAdminPartners(container) {
    const list = state.adminPartners || [];

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner <em>Directory</em></h1>
          <p>Inspect registered service partners, skill sets, and rating averages.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Partner Name</th>
              <th style="padding:14px 18px">Locality</th>
              <th style="padding:14px 18px">Rating</th>
              <th style="padding:14px 18px">Jobs Done</th>
              <th style="padding:14px 18px">KYC Status</th>
              <th style="padding:14px 18px">Account</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:#889c97">0 partners registered in SQLite.</td></tr>` : list.map(p => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${p.full_name}</strong></td>
                <td style="padding:14px 18px">${p.service_locality}, ${p.service_city}</td>
                <td style="padding:14px 18px">★ ${p.rating} (${p.rating_count})</td>
                <td style="padding:14px 18px">${p.completed_jobs}</td>
                <td style="padding:14px 18px"><span class="status-pill ${p.verification_status === 'VERIFIED' ? 'verified' : 'pending'}">${p.verification_status}</span></td>
                <td style="padding:14px 18px">
                  ${p.verification_status !== 'VERIFIED' ? `
                    <button class="button button-small button-lime" style="font-size:11px" onclick="setPartnerStatus('${p.id}', 'VERIFIED', 'verification')">Approve ✓</button>
                  ` : `
                    <button class="button button-small button-danger" style="font-size:11px" onclick="setPartnerStatus('${p.id}', 'SUSPENDED', 'account')">Suspend</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAdminKYC(container) {
    const list = (state.adminVerifications || []).filter(v => v.status === 'PENDING');

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Pending <em>Verification Queue</em></h1>
          <p>Audit masked government ID proofs and locality credentials before partner activation.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Pending Applications (${list.length})</h3>
        ${list.length === 0 ? `<p style="color:#788f89;font-size:13px">All partner verifications audited. Zero backlog.</p>` : list.map(v => `
          <div style="background:#f8faf8;border:1px solid #e1e7df;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span class="booking-ref-tag">${v.verification_type}</span>
              <h4 style="margin:6px 0 2px">${v.partner_name}</h4>
              <p style="font-size:13px;color:#59746e;margin:0">${v.partner_area} · Masked Identifier: <b>${v.masked_identifier}</b></p>
              <small style="color:#829691">Notes: ${v.notes || 'Awaiting Admin KYC Audit'}</small>
            </div>
            <div style="display:flex;gap:8px">
              <button class="button button-small button-lime" onclick="decideKYC('${v.id}', 'VERIFIED')">Approve KYC ✓</button>
              <button class="button button-small button-danger" onclick="decideKYC('${v.id}', 'REJECTED')">Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAdminServices(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Services <em>Catalog Management</em></h1>
          <p>Add, edit prices, or deactivate marketplace offerings.</p>
        </div>
        <button class="button" id="adm-add-service-btn">+ Add New Service</button>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Service</th>
              <th style="padding:14px 18px">Category</th>
              <th style="padding:14px 18px">Base Price</th>
              <th style="padding:14px 18px">Status</th>
              <th style="padding:14px 18px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${state.services.map(s => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${s.icon} ${s.name}</strong></td>
                <td style="padding:14px 18px">${s.category}</td>
                <td style="padding:14px 18px"><b>₹${s.base_price}</b></td>
                <td style="padding:14px 18px"><span class="status-pill verified">ACTIVE</span></td>
                <td style="padding:14px 18px">
                  <button class="button button-small button-ghost" style="font-size:11px" onclick="editAdminService('${s.id}')">Edit Price</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('adm-add-service-btn').onclick = () => {
      document.getElementById('adm-srv-id').value = '';
      document.getElementById('adm-srv-name').value = '';
      document.getElementById('adm-srv-price').value = '149';
      document.getElementById('adm-srv-desc').value = '';
      openModal('#admin-service-modal');
    };
  }

  function renderAdminComplaints(container) {
    const list = state.adminComplaints || [];

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Customer <em>Complaints &amp; Disputes</em></h1>
          <p>Investigate and resolve reported service quality or pricing issues.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Open Disputes (${list.filter(c => c.status === 'OPEN').length})</h3>
        ${list.length === 0 ? `<p style="color:#788f89;font-size:13px">No customer complaints recorded.</p>` : list.map(c => `
          <div style="background:#f8faf8;border:1px solid #e1e7df;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between">
              <strong>${c.category} · Booking: ${c.booking_reference}</strong>
              <span class="status-pill ${c.status.toLowerCase()}">${c.status}</span>
            </div>
            <p style="font-size:13px;color:#4f6b65;margin:8px 0">${c.description}</p>
            ${c.resolution ? `<div style="background:#eef6f3;padding:6px 10px;border-radius:6px;font-size:12px;color:#18534c"><strong>Resolution:</strong> ${c.resolution}</div>` : `
              <button class="button button-small button-lime" style="font-size:11px;margin-top:6px" onclick="resolveComplaint('${c.id}')">Resolve Ticket ✓</button>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAdminSupportTickets(container) {
    const list = state.adminTickets || [];

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Platform <em>Support Tickets</em></h1>
          <p>Respond to customer inquiries and track ticket lifecycle.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Ticket ID</th>
              <th style="padding:14px 18px">Category</th>
              <th style="padding:14px 18px">User</th>
              <th style="padding:14px 18px">Description</th>
              <th style="padding:14px 18px">Status</th>
              <th style="padding:14px 18px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:#889c97">No support tickets found.</td></tr>` : list.map(t => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${t.ticket_reference}</strong></td>
                <td style="padding:14px 18px">${t.category}</td>
                <td style="padding:14px 18px">${t.user_email}</td>
                <td style="padding:14px 18px">${t.description}</td>
                <td style="padding:14px 18px"><span class="ticket-row-badge ${t.status.toLowerCase()}">${t.status}</span></td>
                <td style="padding:14px 18px">
                  <button class="button button-small" style="font-size:11px" onclick="respondSupportTicket('${t.id}')">Reply &amp; Close</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAdminAssistant(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Admin <em>AI Assistant</em></h1>
          <p>Query platform statistics, pending verifications, or top services in natural language.</p>
        </div>
      </div>

      <div class="support-chat-container">
        <div class="support-chat-box" style="height:480px">
          <div class="support-chat-header" style="background:#0a3236">
            <strong>✦ ADMIN ASSISTANT</strong>
            <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:100px">SQL Intelligence</span>
          </div>
          <div class="support-chat-messages" id="adm-assistant-messages-list">
            ${state.admAssistantMessages.map(m => `
              <div class="chat-bubble ${m.sender}">
                ${m.text}
              </div>
            `).join('')}
          </div>
          <div class="support-chat-input-bar">
            <input id="adm-assistant-input" placeholder="e.g. How many bookings were completed? Show top services..." />
            <button class="button button-small" id="adm-assistant-send-btn" style="background:#0a3236">Query <span>→</span></button>
          </div>
        </div>

        <div class="profile-section-card" style="margin:0">
          <h3>Quick SQL Assistant Queries</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="chat-action-chip" style="text-align:left;padding:10px" onclick="runAdminAssistantQuery('How many bookings completed?')">📊 How many bookings were completed?</button>
            <button class="chat-action-chip" style="text-align:left;padding:10px" onclick="runAdminAssistantQuery('Which service has the most bookings?')">⚡ Which service has the most bookings?</button>
            <button class="chat-action-chip" style="text-align:left;padding:10px" onclick="runAdminAssistantQuery('Show pending partner verifications')">🛡️ Show pending partner verifications</button>
            <button class="chat-action-chip" style="text-align:left;padding:10px" onclick="runAdminAssistantQuery('How many complaints are open?')">⚠️ How many complaints are open?</button>
          </div>
        </div>
      </div>
    `;

    const sendBtn = document.getElementById('adm-assistant-send-btn');
    const input = document.getElementById('adm-assistant-input');

    const handleSend = async () => {
      const q = input.value.trim();
      if (!q) return;
      await root.runAdminAssistantQuery(q);
      input.value = '';
    };

    sendBtn.onclick = handleSend;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
  }

  function renderAdminAudits(container) {
    const list = state.adminAudits || [];

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Immutable <em>Audit Logs</em></h1>
          <p>Security trace of administrative decisions and operational actions.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Action</th>
              <th style="padding:14px 18px">Target</th>
              <th style="padding:14px 18px">Description</th>
              <th style="padding:14px 18px">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(a => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><span class="booking-ref-tag">${a.action}</span></td>
                <td style="padding:14px 18px">${a.target_type} (${a.target_id || '—'})</td>
                <td style="padding:14px 18px">${a.description}</td>
                <td style="padding:14px 18px">${new Date(a.created_at).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Admin Operational Handlers
  root.runAdminAssistantQuery = async function(q) {
    state.admAssistantMessages.push({ sender: 'user', text: q });
    try {
      const res = await API.queryAdminAssistant(q);
      state.admAssistantMessages.push({ sender: 'bot', text: res.reply });
    } catch (e) {
      state.admAssistantMessages.push({ sender: 'bot', text: 'Error querying database: ' + e.message });
    }
    renderAdminAssistant(document.getElementById('admin-main-view'));
  };

  root.setCustomerStatus = async function(id, status) {
    try {
      await API.updateAdminCustomerStatus(id, status);
      showToast(`Customer status updated to ${status}.`);
      await refreshAdminData();
      renderAdminCustomers(document.getElementById('admin-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.setPartnerStatus = async function(id, status, actionType) {
    try {
      await API.updateAdminPartnerStatus(id, status, actionType);
      showToast(`Partner status updated to ${status}.`);
      await refreshAdminData();
      renderAdminPartners(document.getElementById('admin-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.decideKYC = async function(id, decision) {
    try {
      await API.decideAdminVerification(id, decision, 'Audited via Admin Desk');
      showToast(`KYC application ${decision}!`);
      await refreshAdminData();
      renderAdminKYC(document.getElementById('admin-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.editAdminService = function(id) {
    const srv = state.services.find(s => s.id === id);
    if (!srv) return;
    document.getElementById('adm-srv-id').value = srv.id;
    document.getElementById('adm-srv-name').value = srv.name;
    document.getElementById('adm-srv-category').value = srv.category;
    document.getElementById('adm-srv-price').value = srv.base_price;
    document.getElementById('adm-srv-desc').value = srv.description;
    openModal('#admin-service-modal');
  };

  root.resolveComplaint = async function(id) {
    const note = prompt('Enter resolution notes:', 'Issue resolved and verified by Admin Desk');
    if (!note) return;
    try {
      await API.resolveAdminComplaint(id, note, 'RESOLVED');
      showToast('Complaint marked as RESOLVED.');
      await refreshAdminData();
      renderAdminComplaints(document.getElementById('admin-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  root.respondSupportTicket = async function(id) {
    const reply = prompt('Enter admin response for customer:', 'Thank you for reaching out. We have investigated and resolved your inquiry.');
    if (!reply) return;
    try {
      await API.respondAdminSupportTicket(id, reply, 'RESOLVED');
      showToast('Support ticket response sent.');
      await refreshAdminData();
      renderAdminSupportTickets(document.getElementById('admin-main-view'));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // ==========================================================================
  // PUBLIC LANDING RENDERING
  // ==========================================================================
  function renderLandingServices(category = 'ALL') {
    const grid = document.getElementById('service-grid');
    if (!grid) return;

    let items = state.services;
    if (category !== 'ALL') {
      items = items.filter(s => s.category === category);
    }

    grid.innerHTML = items.map(s => `
      <div class="service-card">
        <div class="service-icon" style="background:${s.color}">${s.icon}</div>
        <h3>${s.name}</h3>
        <p>${s.description}</p>
        <div class="service-bottom">
          <div>
            <small>STARTING FROM</small>
            <b>₹${s.base_price}</b>
          </div>
          <button class="round-arrow" onclick="startBooking('${s.id}')" aria-label="Book ${s.name}">→</button>
        </div>
      </div>
    `).join('');
  }

  function renderLandingPartners() {
    const grid = document.getElementById('partner-grid');
    if (!grid) return;

    grid.innerHTML = state.partners.map(p => `
      <div class="partner-card">
        <div class="partner-top">
          <div class="partner-avatar" style="background:${p.avatar_bg}">${p.initials}</div>
          <div class="partner-meta">
            <h4>${p.full_name} <span>✓</span></h4>
            <div class="partner-rating">★ ${p.rating} <b>(${p.rating_count} reviews)</b></div>
          </div>
        </div>
        <div class="partner-skills">
          ${(p.primary_skills || []).map(sk => `<span>${sk}</span>`).join('')}
        </div>
        <p class="partner-bio">${p.bio || 'Verified neighbourhood service professional in Lanka, Varanasi.'}</p>
        <button onclick="startBooking(null, '${p.id}')">Book Verified Pro →</button>
      </div>
    `).join('');
  }

  function renderLandingPackages() {
    const grid = document.getElementById('package-grid');
    if (!grid) return;

    const packages = [
      { name: 'Deep Clean & Refresh', desc: 'Home deep clean + bathroom scale removal + dusting', price: 699, icon: '☷', service: 'Home Cleaning' },
      { name: 'Summer Ready Pack', desc: 'Cooler servicing + AC filter clean + fan tune-up', price: 499, icon: '♨', service: 'Cooler Repair & Service' },
      { name: 'Move-In Essentials', desc: 'Curtain drilling + furniture assembly + wash', price: 799, icon: '📦', service: 'House Shifting' }
    ];

    grid.innerHTML = packages.map(p => `
      <div class="package-card">
        <div class="package-icon">${p.icon}</div>
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="package-price">
          <small>BUNDLE PRICE</small>
          <strong>₹${p.price}</strong>
        </div>
        <button class="round-arrow" onclick="startBooking('${p.service}')">→</button>
      </div>
    `).join('');
  }

  // ==========================================================================
  // EVENT LISTENERS & FORM BINDINGS
  // ==========================================================================
  function setupEventListeners() {
    // Landing Navigation
    document.getElementById('landing-login-btn')?.addEventListener('click', () => openModal('#login-modal'));
    document.getElementById('landing-signup-btn')?.addEventListener('click', () => {
      state.signupRole = 'CUSTOMER';
      updateSignupRoleCards();
      openModal('#signup-modal');
    });
    document.getElementById('hero-book-btn')?.addEventListener('click', () => root.startBooking());
    document.getElementById('hero-partner-btn')?.addEventListener('click', () => {
      state.signupRole = 'PARTNER';
      updateSignupRoleCards();
      openModal('#signup-modal');
    });
    document.getElementById('cta-partner-register-btn')?.addEventListener('click', () => {
      state.signupRole = 'PARTNER';
      updateSignupRoleCards();
      openModal('#signup-modal');
    });

    // Footer Links
    document.getElementById('footer-admin-btn')?.addEventListener('click', () => {
      window.location.href = '/admin/login';
    });
    document.getElementById('footer-partner-login-btn')?.addEventListener('click', () => openModal('#login-modal'));
    document.getElementById('footer-partner-apply-btn')?.addEventListener('click', () => {
      state.signupRole = 'PARTNER';
      updateSignupRoleCards();
      openModal('#signup-modal');
    });

    // Close Modal Buttons
    document.querySelectorAll('[data-close-modal]').forEach(b => {
      b.onclick = () => {
        const dialog = b.closest('dialog');
        if (dialog) closeModal(dialog);
      };
    });

    // Category Tabs
    document.getElementById('category-tabs-container')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-tab');
      if (!btn) return;
      document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLandingServices(btn.dataset.category);
    });

    // Quick Search Input
    const taskInput = document.getElementById('task-search');
    const searchSub = document.getElementById('search-submit');
    const handleLandingSearch = () => {
      const q = taskInput.value.trim();
      if (!q) return;
      const match = NLP.matchService(q);
      root.startBooking(match.service.name);
    };
    searchSub?.addEventListener('click', handleLandingSearch);
    taskInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLandingSearch(); });

    // Helper Submit on Landing
    document.getElementById('helper-submit')?.addEventListener('click', () => {
      const text = document.getElementById('helper-text').value.trim();
      const res = NLP.analyzeCompoundRequest(text);
      const resDiv = document.getElementById('helper-result');
      resDiv.removeAttribute('hidden');
      resDiv.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${res.summary}</strong>
            <div style="font-size:12px;color:#cde0d8">Detected: ${res.detectedServices.join(', ')}</div>
          </div>
          <button class="button button-lime" onclick="startBooking('Book a Helper')">Book Now (₹${res.packagePrice}) →</button>
        </div>
      `;
    });

    // Helper Prompt Chips
    document.querySelectorAll('.helper-prompts button').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('helper-text').value = btn.dataset.prompt;
        document.getElementById('helper-submit').click();
      };
    });

    // Role Select Cards in Signup Modal
    document.querySelectorAll('.role-card').forEach(card => {
      card.onclick = () => {
        state.signupRole = card.dataset.signupRole;
        updateSignupRoleCards();
      };
    });

    // Auth Modal Form Submissions
    document.getElementById('email-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        const res = await API.login(email, password);
        showToast('Logged in successfully!');
        onLoginSuccess(res);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      try {
        const res = await API.login(email, password);
        if (res.user.role !== 'ADMIN') {
          showToast('Access Denied: Not an Administrator account.', true);
          API.setToken(null);
          return;
        }
        showToast('Administrator Authenticated.');
        onLoginSuccess(res);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const city = document.getElementById('reg-city').value;
      const pass = document.getElementById('reg-password').value;
      const confirmPass = document.getElementById('reg-confirm-password').value;

      if (pass !== confirmPass) {
        showToast('Passwords do not match.', true);
        return;
      }

      try {
        const res = await API.register({
          email,
          phone: phone ? `+91 ${phone}` : '+91 98000 00000',
          password: pass,
          full_name: name,
          city,
          role: state.signupRole
        });
        showToast('Account created successfully!');
        onLoginSuccess(res);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    // Profile & Security Form Submissions
    document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-profile-name').value.trim();
      const phone = document.getElementById('edit-profile-phone').value.trim();
      const lang = document.getElementById('edit-profile-lang').value;
      const bio = document.getElementById('edit-profile-bio').value.trim();
      try {
        await API.updateProfile({ full_name: name, phone, preferred_language: lang, bio });
        closeModal('#edit-profile-modal');
        showToast('Profile updated.');
        const me = await API.getMe();
        state.currentUser = me.user;
        state.currentProfile = me.profile;
        switchCustomerView('cust-profile');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const curr = document.getElementById('curr-pass-input').value;
      const newP = document.getElementById('new-pass-input').value;
      const confP = document.getElementById('confirm-pass-input').value;
      if (newP !== confP) {
        showToast('New passwords do not match.', true);
        return;
      }
      try {
        await API.changePassword(curr, newP);
        closeModal('#change-password-modal');
        showToast('Password changed successfully.');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('delete-account-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass = document.getElementById('delete-account-pass').value;
      try {
        await API.deleteAccount(pass);
        closeModal('#delete-account-modal');
        showToast('Your account has been deleted.');
        handleLogout();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('add-address-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = document.getElementById('new-addr-label').value;
      const addr = document.getElementById('new-addr-line').value.trim();
      const loc = document.getElementById('new-addr-locality').value.trim();
      const pin = document.getElementById('new-addr-pincode').value.trim();
      const land = document.getElementById('new-addr-landmark').value.trim();
      try {
        await API.addAddress({ label, address: addr, locality: loc, pincode: pin, landmark: land });
        closeModal('#add-address-modal');
        showToast('Address saved.');
        await refreshCustomerData();
        switchCustomerView('cust-addresses');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('create-ticket-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cat = document.getElementById('tkt-category').value;
      const ref = document.getElementById('tkt-booking-ref').value.trim();
      const desc = document.getElementById('tkt-description').value.trim();
      try {
        const res = await API.createSupportTicket({ category: cat, booking_reference: ref, description: desc });
        closeModal('#create-ticket-modal');
        showToast(`Support Ticket Created: ${res.ticket_reference}`);
        await refreshCustomerData();
        switchCustomerView('cust-support');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('review-submit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bId = document.getElementById('review-booking-id').value;
      const comment = document.getElementById('review-comment').value.trim();
      try {
        await API.submitReview(bId, 5, comment);
        closeModal('#review-modal');
        showToast('Thank you for rating your service pro!');
        await refreshCustomerData();
        switchCustomerView('cust-reviews');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('complaint-submit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bId = document.getElementById('complaint-booking-id').value;
      const cat = document.getElementById('complaint-category').value;
      const desc = document.getElementById('complaint-description').value.trim();
      try {
        await API.fileComplaint(bId, cat, desc);
        closeModal('#complaint-modal');
        showToast('Dispute filed. Admin desk has been notified.');
        await refreshCustomerData();
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('admin-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adm-srv-id').value;
      const name = document.getElementById('adm-srv-name').value.trim();
      const cat = document.getElementById('adm-srv-category').value;
      const price = document.getElementById('adm-srv-price').value;
      const desc = document.getElementById('adm-srv-desc').value.trim();
      const icon = document.getElementById('adm-srv-icon').value.trim() || '⚡';
      const color = document.getElementById('adm-srv-color').value.trim() || '#fff1cf';

      try {
        if (id) {
          await API.updateAdminService(id, { name, category: cat, base_price: parseInt(price), description: desc });
          showToast('Service updated in database.');
        } else {
          await API.createAdminService({ name, category: cat, base_price: parseInt(price), description: desc, icon, color });
          showToast('New service added to catalog.');
        }
        closeModal('#admin-service-modal');
        await loadPublicCatalog();
        await refreshAdminData();
        renderAdminServices(document.getElementById('admin-main-view'));
      } catch (err) {
        showToast(err.message, true);
      }
    });

    // Navigation Switchers in Dashboards
    document.getElementById('customer-nav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (btn) switchCustomerView(btn.dataset.view);
    });

    document.getElementById('partner-nav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (btn) switchPartnerView(btn.dataset.view);
    });

    document.getElementById('admin-nav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (btn) switchAdminView(btn.dataset.view);
    });

    // Logout and Exit Buttons
    document.getElementById('cust-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('part-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('adm-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('cust-exit-to-landing-btn')?.addEventListener('click', exitToLanding);
    document.getElementById('part-exit-to-landing-btn')?.addEventListener('click', exitToLanding);
    document.getElementById('adm-exit-to-landing-btn')?.addEventListener('click', exitToLanding);

    // Switch between login & signup modals
    document.getElementById('switch-to-signup-btn')?.addEventListener('click', () => {
      closeModal('#login-modal');
      openModal('#signup-modal');
    });
    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => {
      closeModal('#signup-modal');
      openModal('#login-modal');
    });
  }

  function updateSignupRoleCards() {
    document.querySelectorAll('.role-card').forEach(c => {
      c.classList.toggle('active', c.dataset.signupRole === state.signupRole);
    });
  }

  async function handleLogout() {
    await API.logout();
    state.currentUser = null;
    state.currentRole = null;
    state.currentProfile = null;
    showToast('Logged out.');
    exitToLanding();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(typeof window !== 'undefined' ? window : this);
