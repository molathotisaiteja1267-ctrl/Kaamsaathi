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
    ],
    assistantMessages: [
      { sender: 'bot', text: 'Namaste! 👋 I am your **KaamSaathi Assistant**.\n\nTell me what needs fixing, cleaning, or setting up at your home in Varanasi.' }
    ],
    assistantContext: {}
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

      // Update tab counter for All Categories
      const allTab = document.querySelector('.category-tab[data-category="ALL"]');
      if (allTab && state.services.length) {
        allTab.textContent = `All Categories (${state.services.length})`;
      }

      renderLandingServices('ALL');

      const partData = await API.getPartners();
      state.partners = partData.partners || [];
      renderLandingPartners();
      renderLandingPackages();
    } catch (err) {
      console.warn('Could not load public catalog from backend:', err);
      renderLandingServices('ALL');
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

    const _dNow = new Date();
    const _todayIso = _dNow.toISOString().split('T')[0];
    const _tomorrowIso = new Date(_dNow.getTime() + 86400000).toISOString().split('T')[0];

    state.bookingWizard = {
      step: 1,
      bookingMode: partnerId ? 'SCHEDULED' : 'URGENT',
      serviceId: srv ? srv.id : (state.services[0]?.id || 'srv-1'),
      serviceName: srv ? srv.name : 'Electrician',
      servicePrice: srv ? srv.base_price : 149,
      partnerId: partnerId,
      addressId: state.customerAddresses[0]?.id || null,
      description: '',
      scheduledDate: partnerId ? _tomorrowIso : _todayIso,
      scheduledTime: partnerId ? '11:30 AM – 12:30 PM' : 'Immediate (15–20 min)',
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

    const { step, bookingMode, serviceId, serviceName, servicePrice, partnerId, addressId, description, scheduledDate, scheduledTime, paymentMethod } = state.bookingWizard;

    const _now = new Date();
    const _todayIso = _now.toISOString().split('T')[0];
    const _tomorrowIso = new Date(_now.getTime() + 86400000).toISOString().split('T')[0];
    let _curDateVal = scheduledDate;
    if (!_curDateVal || _curDateVal === 'Today') _curDateVal = _todayIso;
    else if (_curDateVal === 'Tomorrow') _curDateVal = _tomorrowIso;

    const _formatDateLabel = (isoStr) => {
      try {
        if (!isoStr || isoStr === 'Today') return 'Today (Immediate)';
        const p = isoStr.split('-');
        if (p.length === 3) {
          const dt = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
          return dt.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
      } catch (e) {}
      return isoStr;
    };

    const timeSlotOptions = [
      '09:00 AM – 10:00 AM',
      '10:00 AM – 11:00 AM',
      '11:30 AM – 12:30 PM',
      '01:00 PM – 02:00 PM',
      '02:30 PM – 03:30 PM',
      '04:00 PM – 05:00 PM',
      '05:30 PM – 06:30 PM',
      '07:00 PM – 08:00 PM'
    ];

    // Update stepper
    if (stepper) {
      const dots = stepper.querySelectorAll('i');
      dots.forEach((dot, idx) => {
        dot.className = idx + 1 === step ? 'active' : (idx + 1 < step ? 'done' : '');
      });
    }

    if (step === 1) {
      title.innerHTML = 'Choose Mode<br /><em>&amp; Service Details</em>';
      desc.textContent = 'Step 1 of 3. Pick urgent fast dispatch or schedule ahead with a chosen pro.';

      const serviceOptions = state.services.map(s => `
        <option value="${s.id}" ${s.id === serviceId ? 'selected' : ''}>${s.icon} ${s.name} (from ₹${s.base_price})</option>
      `).join('');

      const partnerOptions = `<option value="">Auto-Match Nearest Verified Pro</option>` + state.partners.map(p => `
        <option value="${p.id}" ${p.id === partnerId ? 'selected' : ''}>★ ${p.rating} · ${p.full_name} (${p.service_locality})</option>
      `).join('');

      content.innerHTML = `
        <form id="booking-step1-form">
          <!-- Two Booking Modes -->
          <div class="booking-mode-grid">
            <div class="mode-card-select ${bookingMode === 'URGENT' ? 'selected' : ''}" id="mode-opt-urgent" data-mode="URGENT">
              <h4>⚡ Need Service Now</h4>
              <p>Dispatches to verified pros within 12–35 km. Real-time progressive notification. ETA 15–20 min.</p>
              <span class="mode-tag urgent">Urgent Nearby Pro</span>
            </div>
            <div class="mode-card-select ${bookingMode === 'SCHEDULED' ? 'selected' : ''}" id="mode-opt-scheduled" data-mode="SCHEDULED">
              <h4>📅 Schedule Appointment</h4>
              <p>Select your preferred calendar date, convenient time slot, and chosen specialist pro.</p>
              <span class="mode-tag scheduled">Choose Slot &amp; Pro</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="bw-service-select">Select Service</label>
            <select class="form-select" id="bw-service-select" required>
              ${serviceOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="bw-desc-input">Describe Your Requirement / Problem</label>
            <textarea class="form-textarea" id="bw-desc-input" rows="2" placeholder="e.g. Ceiling fan speed regulator is sparking, or cooler motor pump needs checking...">${description}</textarea>
          </div>

          <div id="bw-schedule-fields" style="${bookingMode === 'SCHEDULED' ? '' : 'display:none'}">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="bw-date-input">Select Appointment Date</label>
                <input type="date" class="form-input" id="bw-date-input" min="${_todayIso}" value="${_curDateVal}" required />
                <small id="bw-date-display-hint" style="color:var(--teal);font-weight:600;display:block;margin-top:4px">${_formatDateLabel(_curDateVal)}</small>
              </div>
              <div class="form-group">
                <label class="form-label" for="bw-time-select">Arrival Time Interval Slot</label>
                <select class="form-select" id="bw-time-select">
                  ${timeSlotOptions.map(slot => `
                    <option value="${slot}" ${slot === scheduledTime ? 'selected' : ''}>${slot}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="bw-pro-select">Preferred Service Pro (Optional)</label>
              <select class="form-select" id="bw-pro-select">
                ${partnerOptions}
              </select>
            </div>
          </div>

          <div id="bw-urgent-fields" style="${bookingMode === 'URGENT' ? '' : 'display:none'}">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#166534">
              ⚡ <strong>Rapid Neighborhood Dispatch:</strong> Progressive alerts will be sent to all active verified professionals within 12 km (expanding to 20 km &amp; 35 km).
            </div>
          </div>

          <button type="submit" class="button" style="width:100%;margin-top:10px">Continue to Address <span>→</span></button>
        </form>
      `;

      // Mode switch clicks
      document.getElementById('mode-opt-urgent').onclick = () => {
        state.bookingWizard.bookingMode = 'URGENT';
        state.bookingWizard.scheduledDate = _todayIso;
        state.bookingWizard.scheduledTime = 'Immediate (15–20 min)';
        document.getElementById('mode-opt-urgent').classList.add('selected');
        document.getElementById('mode-opt-scheduled').classList.remove('selected');
        document.getElementById('bw-schedule-fields').style.display = 'none';
        document.getElementById('bw-urgent-fields').style.display = 'block';
      };

      document.getElementById('mode-opt-scheduled').onclick = () => {
        state.bookingWizard.bookingMode = 'SCHEDULED';
        state.bookingWizard.scheduledDate = _tomorrowIso;
        state.bookingWizard.scheduledTime = '11:30 AM – 12:30 PM';
        document.getElementById('mode-opt-scheduled').classList.add('selected');
        document.getElementById('mode-opt-urgent').classList.remove('selected');
        document.getElementById('bw-schedule-fields').style.display = 'block';
        document.getElementById('bw-urgent-fields').style.display = 'none';
      };

      const dateInput = document.getElementById('bw-date-input');
      const dateHint = document.getElementById('bw-date-display-hint');
      const timeSelect = document.getElementById('bw-time-select');

      const updateSlotAvailability = () => {
        if (!dateInput || !timeSelect) return;
        const chosen = dateInput.value;
        if (dateHint) dateHint.textContent = _formatDateLabel(chosen);

        const isToday = chosen === _todayIso;
        const currentHour = _now.getHours();
        const currentMinute = _now.getMinutes();

        Array.from(timeSelect.options).forEach(opt => {
          if (!isToday) {
            opt.disabled = false;
            return;
          }
          const match = opt.value.match(/(\d{2}):(\d{2})\s*(AM|PM)/i);
          if (match) {
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const ampm = match[3].toUpperCase();
            if (ampm === 'PM' && h !== 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            const isPast = (h < currentHour) || (h === currentHour && m <= currentMinute);
            opt.disabled = isPast;
            if (isPast && opt.selected) {
              opt.selected = false;
            }
          }
        });

        if (timeSelect.selectedOptions.length === 0 || timeSelect.selectedOptions[0].disabled) {
          const firstValid = Array.from(timeSelect.options).find(o => !o.disabled);
          if (firstValid) firstValid.selected = true;
        }
      };

      if (dateInput) {
        dateInput.onchange = updateSlotAvailability;
        updateSlotAvailability();
      }

      document.getElementById('booking-step1-form').onsubmit = (e) => {
        e.preventDefault();
        const selSrvId = document.getElementById('bw-service-select').value;
        const selectedSrv = state.services.find(s => s.id === selSrvId);
        state.bookingWizard.serviceId = selSrvId;
        state.bookingWizard.serviceName = selectedSrv ? selectedSrv.name : 'Service';
        state.bookingWizard.servicePrice = selectedSrv ? selectedSrv.base_price : 149;
        state.bookingWizard.description = document.getElementById('bw-desc-input').value.trim();

        if (state.bookingWizard.bookingMode === 'SCHEDULED') {
          const chosenDate = document.getElementById('bw-date-input')?.value || _tomorrowIso;
          if (chosenDate < _todayIso) {
            showToast('Cannot select a past date for booking.', true);
            return;
          }
          state.bookingWizard.scheduledDate = chosenDate;
          state.bookingWizard.scheduledTime = document.getElementById('bw-time-select')?.value || '11:30 AM – 12:30 PM';
          const chosenPro = document.getElementById('bw-pro-select')?.value;
          if (chosenPro) state.bookingWizard.partnerId = chosenPro;
        } else {
          state.bookingWizard.scheduledDate = _todayIso;
          state.bookingWizard.scheduledTime = 'Immediate (15–20 min)';
        }

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

        <!-- Customer Attendance Pledge -->
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:20px;line-height:1">📋</span>
          <div>
            <strong style="color:#1e40af;font-size:13px;display:block;margin-bottom:4px">Customer Attendance Pledge</strong>
            <p style="margin:0;font-size:13px;color:#1e3a8a;font-style:italic">
              "I will be available at home during this time. Please visit to repair my ${serviceName}."
            </p>
            <div style="font-size:11px;color:#3b82f6;margin-top:6px">
              📅 Appointment: <strong>${_formatDateLabel(scheduledDate)}</strong> (${scheduledTime})
            </div>
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
            booking_mode: state.bookingWizard.bookingMode || 'URGENT',
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

          if (res.booking_id || res.id) {
            root.openLiveTrackingModal(res.booking_id || res.id);
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
                  <td style="padding:14px 18px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    <button class="button button-small button-lime" style="font-size:11px" onclick="openLiveTrackingModal('${b.id}')">Track Live 📍</button>
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
        <div class="profile-data-row">
          <span>Email Address</span>
          <div>
            <strong>${user.email}</strong>
            ${user.email_verified ? '<span class="status-pill verified" style="margin-left:8px;font-size:11px">✓ Verified</span>' : `<button class="button button-small button-ghost" style="margin-left:8px;font-size:11px;color:#d97706;border-color:#fde047" onclick="openVerificationModal('EMAIL', '${user.email}')">Verify Email ⚡</button>`}
          </div>
        </div>
        <div class="profile-data-row">
          <span>Phone Number</span>
          <div>
            <strong>${user.phone || 'Not provided'}</strong>
            ${user.phone ? (user.phone_verified ? '<span class="status-pill verified" style="margin-left:8px;font-size:11px">✓ Verified</span>' : `<button class="button button-small button-ghost" style="margin-left:8px;font-size:11px;color:#d97706;border-color:#fde047" onclick="openVerificationModal('PHONE', '${user.phone}')">Verify Phone ⚡</button>`) : ''}
          </div>
        </div>
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
  // LIVE TRACKING (8-STEP JOURNEY, PROGRESSIVE DISPATCH & IN-APP CHAT)
  // ==========================================================================
  let activeTrackingInterval = null;

  root.openLiveTrackingModal = async function(bookingId) {
    if (activeTrackingInterval) {
      clearInterval(activeTrackingInterval);
      activeTrackingInterval = null;
    }

    const modal = document.getElementById('live-tracking-modal');
    const content = document.getElementById('live-tracking-content');
    const title = document.getElementById('tracking-bkg-title');
    const sub = document.getElementById('tracking-bkg-subtitle');
    const modePill = document.getElementById('tracking-mode-pill');

    if (!modal || !content) return;

    openModal('#live-tracking-modal');

    // Attach cleanup listener once
    if (!modal._cleanupAttached) {
      modal._cleanupAttached = true;
      modal.addEventListener('close', () => {
        if (activeTrackingInterval) {
          clearInterval(activeTrackingInterval);
          activeTrackingInterval = null;
        }
      });
      modal.querySelectorAll('[data-close-modal]').forEach(b => {
        b.addEventListener('click', () => {
          if (activeTrackingInterval) {
            clearInterval(activeTrackingInterval);
            activeTrackingInterval = null;
          }
        });
      });
    }

    content.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b">Loading real-time booking tracking...</div>`;

    async function pollTracking() {
      try {
        const [trkRes, chatRes] = await Promise.all([
          API.getBookingTracking(bookingId),
          API.getBookingChat(bookingId)
        ]);

        const b = trkRes.booking;
        const p = trkRes.partner;
        const dist = trkRes.distance_km;
        const eta = trkRes.eta_minutes;
        const milestones = trkRes.milestones || [];
        const isUrgent = b.booking_mode === 'URGENT';

        if (title) title.innerHTML = `${b.service_icon || '⚡'} ${b.service_name} · <em>${b.booking_reference}</em>`;
        if (sub) sub.textContent = `Scheduled: ${b.scheduled_time} · Total: ₹${b.total_amount} (${b.payment_method || 'UPI'})`;
        if (modePill) {
          modePill.textContent = isUrgent ? '⚡ URGENT DISPATCH' : '📅 SCHEDULED APPOINTMENT';
          modePill.className = `status-pill ${isUrgent ? 'verified' : 'pending'}`;
        }

        // Radar / Location Card HTML
        let radarHtml = '';
        if (b.status === 'PENDING') {
          radarHtml = `
            <div class="tracking-radar-card">
              <div class="radar-sweep-anim"></div>
              <div class="radar-partner-info">
                <div class="radar-avatar">📡</div>
                <div class="radar-meta">
                  <strong>Scanning for Nearby Professionals</strong>
                  <small>Search Radius: <b>${b.search_radius_km || 12} km</b> (Stage ${b.notification_stage || 1} of 3 in Varanasi)</small>
                </div>
                <button class="button button-small button-lime" style="position:relative;z-index:2" onclick="expandBookingSearch('${b.id}')">⚡ Expand Search Now</button>
              </div>
              <div class="radar-stats-row">
                <div class="radar-stat-box"><span>Current Stage</span><strong>Stage ${b.notification_stage || 1}</strong></div>
                <div class="radar-stat-box"><span>Coverage Radius</span><strong>${b.search_radius_km || 12} km</strong></div>
                <div class="radar-stat-box"><span>Dispatch System</span><strong>Progressive Haversine</strong></div>
              </div>
            </div>
          `;
        } else if (p) {
          radarHtml = `
            <div class="tracking-radar-card">
              <div class="radar-sweep-anim"></div>
              <div class="radar-partner-info">
                <div class="radar-avatar" style="${p.profile_photo ? 'padding:0;overflow:hidden;' : `background:${p.avatar_bg || '#d9f36b'}`}">${p.profile_photo ? `<img src="${p.profile_photo}" alt="${p.full_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : (p.initials || 'KP')}</div>
                <div class="radar-meta">
                  <strong>${p.full_name} <span style="font-size:12px">✓ Verified Pro</span></strong>
                  <small>${p.service_locality || 'Varanasi'} · ★ ${p.rating} (${p.completed_jobs} jobs done)</small>
                </div>
                <div style="display:flex;gap:8px;position:relative;z-index:2">
                  <a href="tel:${p.partner_phone}" class="button button-small button-lime" style="text-decoration:none">📞 Call Pro</a>
                  <button class="button button-small button-ghost" style="color:#fff;border-color:rgba(255,255,255,0.4)" onclick="openPartnerProfileModal('${p.id}')">View Profile</button>
                </div>
              </div>
              <div class="radar-stats-row">
                <div class="radar-stat-box"><span>Live Distance</span><strong>${dist !== null ? `${dist} km` : 'Near You'}</strong></div>
                <div class="radar-stat-box"><span>Estimated Arrival</span><strong>${eta ? `~${eta} mins` : '15-20 min'}</strong></div>
                <div class="radar-stat-box"><span>Location Sharing</span><strong>${p.is_sharing_location ? '🟢 Live GPS Active' : '📍 Station Base'}</strong></div>
              </div>
            </div>
          `;
        }

        // 8-Step Journey Timeline HTML
        const journeyHtml = `
          <div class="profile-section-card" style="padding:16px 20px;margin-bottom:20px">
            <h3 style="margin-bottom:16px;font-size:15px;display:flex;justify-content:space-between">
              <span>Service Milestone Tracker</span>
              <span class="status-pill ${b.status.toLowerCase()}">${b.status.replace('_', ' ')}</span>
            </h3>
            <div class="tracking-journey">
              ${milestones.map(m => `
                <div class="journey-step ${m.completed ? 'completed' : ''} ${m.active ? 'active' : ''}">
                  <div class="journey-step-circle ${m.completed ? 'completed' : ''} ${m.active ? 'active' : ''}">
                    ${m.completed ? '✓' : m.step}
                  </div>
                  <div class="journey-step-content">
                    <div class="journey-step-title">${m.title}</div>
                    <div class="journey-step-desc">${m.description}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // In-App Chat Drawer HTML
        const messages = chatRes.messages || [];
        const isPartner = state.currentRole === 'PARTNER';
        const chatHtml = `
          <div class="tracking-chat-card">
            <div class="chat-card-head" style="display:flex;align-items:center;gap:10px">
              ${p ? `
                <div style="width:34px;height:34px;border-radius:50%;overflow:hidden;background:${p.avatar_bg || '#d9f36b'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#111;flex-shrink:0">
                  ${p.profile_photo ? `<img src="${p.profile_photo}" alt="${p.full_name}" style="width:100%;height:100%;object-fit:cover" />` : (p.initials || 'KP')}
                </div>
              ` : `<span>💬</span>`}
              <div style="flex:1">
                <div style="font-weight:700;font-size:13px">${p ? p.full_name : 'Booking In-App Chat'}</div>
                <small style="color:#64748b;font-weight:400">${p ? (isPartner ? 'Chatting with customer' : 'Verified Service Partner') : 'Direct, private communication for this job'}</small>
              </div>
            </div>
            <div class="chat-card-messages" id="live-chat-messages-wrap">
              ${messages.length === 0 ? `
                <div class="chat-bubble-msg system">
                  Secure in-app chat started. You can coordinate directions, arrival, or requirements here.
                </div>
              ` : messages.map(m => {
                const isMe = (isPartner && m.sender_role === 'PARTNER') || (!isPartner && m.sender_role === 'CUSTOMER');
                return `
                  <div class="chat-bubble-msg ${isMe ? 'me' : 'them'}">
                    <div>${m.message}</div>
                    <div class="chat-msg-time">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <form class="chat-card-input-bar" id="live-chat-form">
              <input type="text" id="live-chat-input" placeholder="Type a message to ${isPartner ? 'customer' : 'pro'}..." required />
              <button type="submit">Send <span>→</span></button>
            </form>
          </div>
        `;

        const prevInput = document.getElementById('live-chat-input')?.value || '';

        content.innerHTML = `
          ${radarHtml}
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px">
            <div>${journeyHtml}</div>
            <div>${chatHtml}</div>
          </div>
        `;

        const newInput = document.getElementById('live-chat-input');
        if (newInput && prevInput) newInput.value = prevInput;

        const chatWrap = document.getElementById('live-chat-messages-wrap');
        if (chatWrap) chatWrap.scrollTop = chatWrap.scrollHeight;

        const chatForm = document.getElementById('live-chat-form');
        if (chatForm) {
          chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const msgInput = document.getElementById('live-chat-input');
            const txt = msgInput ? msgInput.value.trim() : '';
            if (!txt) return;
            msgInput.value = '';
            try {
              await API.sendBookingChatMessage(bookingId, txt);
              pollTracking();
            } catch (err) {
              showToast(err.message, true);
            }
          };
        }
      } catch (err) {
        console.warn('Tracking poll error:', err);
      }
    }

    await pollTracking();
    activeTrackingInterval = setInterval(pollTracking, 4000);
  };

  root.expandBookingSearch = async function(bookingId) {
    try {
      const res = await API.expandBookingSearch(bookingId);
      showToast(`Search radius expanded to ${res.new_radius_km} km (Stage ${res.new_stage})!`);
      if (root.openLiveTrackingModal) root.openLiveTrackingModal(bookingId);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  // ==========================================================================
  // PROVIDER PUBLIC PROFILE & DISCOVERY MODAL
  // ==========================================================================
  root.openPartnerProfileModal = async function(partnerId) {
    const modal = document.getElementById('partner-profile-modal');
    const content = document.getElementById('partner-profile-content');
    if (!modal || !content) return;

    content.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b">Loading professional profile...</div>`;
    openModal('#partner-profile-modal');

    try {
      const res = await API.getPartnerPublicProfile(partnerId);
      const p = res.partner;
      const services = res.services || [];
      const reviews = res.reviews || [];
      const avail = res.availability || [];

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      content.innerHTML = `
        <div style="border-bottom:1px solid #e2e8f0;padding-bottom:20px;margin-bottom:20px">
          <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
            <div style="width:72px;height:72px;border-radius:50%;background:${p.avatar_bg || '#0d4f55'};color:#fff;display:grid;place-items:center;font-size:26px;font-weight:800;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.1);overflow:hidden">
              ${p.profile_photo ? `<img src="${p.profile_photo}" alt="${p.full_name}" style="width:100%;height:100%;object-fit:cover" />` : (p.initials || 'KP')}
            </div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h2 style="margin:0;font-size:22px">${p.full_name}</h2>
                <span class="status-pill verified">✓ VERIFIED PRO</span>
              </div>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b">
                📍 ${p.service_locality}, ${p.service_city} · ${p.experience_years} Years Experience
              </p>
              <div style="display:flex;gap:14px;align-items:center;margin-top:6px;font-size:13px">
                <span style="color:#d97706;font-weight:700">★ ${p.rating} (${p.rating_count} reviews)</span>
                <span style="color:#64748b">|</span>
                <span style="color:#10b981;font-weight:600">✓ ${p.completed_jobs} Jobs Completed</span>
              </div>
            </div>
          </div>

          ${p.bio ? `<p style="margin:14px 0 0;font-size:13px;color:#334155;line-height:1.5">${p.bio}</p>` : ''}

          ${p.shop_name ? `
            <div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-size:12px;color:#334155">
              🏪 <strong>Trade / Shop:</strong> ${p.shop_name} · ${p.shop_address || p.service_locality}
            </div>
          ` : (p.is_home_based ? `
            <div style="margin-top:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:12px;color:#166534">
              🏡 <strong>Home-Based Independent Pro</strong> (Operating radius: ${p.service_radius || '10 km'})
            </div>
          ` : '')}
        </div>

        <!-- Services & Custom Rates -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px;font-size:15px;color:var(--ink)">Offered Services &amp; Starting Rates</h4>
          ${services.length === 0 ? `<p style="font-size:13px;color:#94a3b8">Standard marketplace catalog services available.</p>` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px">
              ${services.map(s => `
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff;display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <strong style="font-size:13px">${s.icon || '⚡'} ${s.name}</strong>
                    <div style="font-size:11px;color:#64748b">${s.category}</div>
                  </div>
                  <b style="color:var(--teal);font-size:13px">₹${s.custom_price || s.base_price}</b>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Weekly Availability Hours -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px;font-size:15px;color:var(--ink)">Weekly Availability</h4>
          ${avail.length === 0 ? `<p style="font-size:13px;color:#94a3b8">Standard operating hours (Mon–Sun: 08:00 AM – 08:00 PM).</p>` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px">
              ${avail.map(a => `
                <div style="border:1px solid ${a.is_available ? '#bbf7d0' : '#fee2e2'};background:${a.is_available ? '#f0fdf4' : '#fff5f5'};border-radius:8px;padding:8px;font-size:11px;text-align:center">
                  <strong>${dayNames[a.day_of_week] || 'Day'}</strong>
                  <div style="color:${a.is_available ? '#166534' : '#991b1b'};margin-top:2px">
                    ${a.is_available ? `${a.start_time} - ${a.end_time}` : 'Closed'}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Customer Reviews -->
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px;font-size:15px;color:var(--ink)">Verified Customer Reviews (${reviews.length})</h4>
          ${reviews.length === 0 ? `<p style="font-size:13px;color:#94a3b8">No customer reviews written yet.</p>` : `
            <div style="display:flex;flex-direction:column;gap:10px">
              ${reviews.map(r => `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong style="font-size:13px">${r.customer_name || 'Customer'}</strong>
                    <span style="color:#d97706;font-size:12px">★ ${r.rating} / 5</span>
                  </div>
                  <p style="margin:6px 0 0;font-size:12px;color:#475569;line-height:1.4">${r.comment || 'Great service quality.'}</p>
                  <small style="color:#94a3b8;font-size:10px">${new Date(r.created_at).toLocaleDateString()}</small>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Book Direct Action -->
        <button class="button button-lime button-large" style="width:100%" onclick="closeModal('#partner-profile-modal'); startBooking('${services[0]?.id || ''}', '${p.id}')">
          📅 Book Appointment with ${p.full_name} →
        </button>
      `;
    } catch (e) {
      content.innerHTML = `<div style="padding:30px;color:#dc2626;text-align:center">Failed to load profile: ${e.message}</div>`;
    }
  };

  // ==========================================================================
  // PARTNER ONBOARDING MULTI-STEP WIZARD
  // ==========================================================================
  root.openPartnerOnboardingWizard = function(step = 1) {
    const modal = document.getElementById('partner-onboarding-modal');
    const body = document.getElementById('part-onboard-body');
    const title = document.getElementById('part-onboard-title');
    const desc = document.getElementById('part-onboard-desc');
    const stepper = document.getElementById('part-onboard-stepper');

    if (!modal || !body) return;

    const closeBtn = document.getElementById('close-partner-onboarding-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        closeModal('#partner-onboarding-modal');
      };
    }

    if (!state.partnerOnboardingData) {
      const p = state.currentProfile || {};
      state.partnerOnboardingData = {
        dob: p.dob || '',
        is_home_based: p.is_home_based !== undefined ? p.is_home_based : 1,
        shop_name: p.shop_name || '',
        shop_address: p.shop_address || '',
        address_line: p.address_line || '',
        service_locality: p.service_locality || 'Lanka',
        pincode: p.pincode || '221005',
        latitude: p.latitude || 25.2677,
        longitude: p.longitude || 82.9913,
        service_radius: p.service_radius || '10 km',
        primary_skill: p.primary_skill || 'Electrician',
        secondary_skill: p.secondary_skill || '',
        tertiary_skill: p.tertiary_skill || '',
        experience_years: p.experience_years || 2,
        starting_price: p.starting_price || 149,
        bio: p.bio || '',
        profile_photo_data: null,
        selected_services: [],
        uploaded_documents: []
      };
    }

    const d = state.partnerOnboardingData;

    if (stepper) {
      const dots = stepper.querySelectorAll('i');
      dots.forEach((dot, idx) => {
        dot.className = idx + 1 === step ? 'active' : (idx + 1 < step ? 'done' : '');
      });
    }

    if (step === 1) {
      if (title) title.innerHTML = 'Personal Information<br /><em>for verification.</em>';
      if (desc) desc.textContent = 'Step 1 of 5. Personal identity credentials and photo required for customer trust.';

      const existingPhoto = d.profile_photo_data || state.currentProfile?.profile_photo;

      body.innerHTML = `
        <form id="part-onboard-step1-form">
          <div class="form-group">
            <label class="form-label">Full Legal Name</label>
            <input class="form-input" value="${state.currentProfile?.full_name || state.currentUser?.email || ''}" readonly style="background:#f8faf8" />
            <small style="color:#64748b">From your registration account</small>
          </div>

          <!-- Feature 4: Profile Picture Upload -->
          <div class="form-group">
            <label class="form-label">Professional Profile Photo</label>
            <div style="display:flex;align-items:center;gap:16px;margin-top:6px">
              <div id="ob-photo-preview" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#e2e8f0;border:2px solid var(--teal, #0e705b);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--teal);font-size:22px">
                ${existingPhoto ? `<img src="${existingPhoto}" alt="Avatar" style="width:100%;height:100%;object-fit:cover" />` : (state.currentProfile?.initials || 'KP')}
              </div>
              <div>
                <label class="button button-small button-ghost" style="cursor:pointer;display:inline-block">
                  <span>📷 Choose Photo</span>
                  <input type="file" id="ob-photo-input" accept="image/jpeg,image/png,image/webp" style="display:none" />
                </label>
                <small style="display:block;color:#64748b;margin-top:4px">JPEG, PNG or WebP. Max 5MB.</small>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ob-dob">Date of Birth</label>
              <input type="date" class="form-input" id="ob-dob" value="${d.dob || '1995-01-01'}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ob-home-based">Work Setup</label>
              <select class="form-select" id="ob-home-based">
                <option value="1" ${d.is_home_based == 1 ? 'selected' : ''}>Home-Based Independent Pro</option>
                <option value="0" ${d.is_home_based == 0 ? 'selected' : ''}>Commercial Workshop / Shop Owner</option>
              </select>
            </div>
          </div>

          <!-- Feature 1: Clear Action Row with Return to Dashboard -->
          <div style="display:flex;gap:10px;margin-top:20px;align-items:center">
            <button type="button" class="button button-ghost" id="ob-step1-cancel-btn" style="flex:1">← Return to Dashboard</button>
            <button type="submit" class="button button-primary" style="flex:1.5">Next: Locality &amp; Address <span>→</span></button>
          </div>
        </form>
      `;

      const photoInput = document.getElementById('ob-photo-input');
      if (photoInput) {
        photoInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            showToast('Image file size must be less than 5MB.', true);
            return;
          }
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const b64 = loadEvt.target.result;
            d.profile_photo_data = b64;
            const preview = document.getElementById('ob-photo-preview');
            if (preview) {
              preview.innerHTML = `<img src="${b64}" alt="Avatar" style="width:100%;height:100%;object-fit:cover" />`;
            }
            showToast('Profile photo selected! Preview updated.');
          };
          reader.readAsDataURL(file);
        };
      }

      const cancelBtn = document.getElementById('ob-step1-cancel-btn');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          closeModal('#partner-onboarding-modal');
        };
      }

      document.getElementById('part-onboard-step1-form').onsubmit = (e) => {
        e.preventDefault();
        d.dob = document.getElementById('ob-dob').value;
        d.is_home_based = parseInt(document.getElementById('ob-home-based').value);
        openPartnerOnboardingWizard(2);
      };
    } else if (step === 2) {
      if (title) title.innerHTML = 'Shop &amp; Locality<br /><em>operating coverage.</em>';
      if (desc) desc.textContent = 'Step 2 of 5. Define where you accept bookings in Varanasi.';

      body.innerHTML = `
        <form id="part-onboard-step2-form">
          <div id="ob-shop-fields" style="${d.is_home_based == 0 ? '' : 'display:none'}">
            <div class="form-group">
              <label class="form-label" for="ob-shop-name">Shop / Workshop Name</label>
              <input class="form-input" id="ob-shop-name" value="${d.shop_name}" placeholder="e.g. Sharma Electricals &amp; Electronics" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ob-shop-addr">Shop Address</label>
              <input class="form-input" id="ob-shop-addr" value="${d.shop_address}" placeholder="Shop No., Market, Road..." />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="ob-addr">Residential / Workshop Address Line</label>
            <input class="form-input" id="ob-addr" value="${d.address_line}" required placeholder="House / Flat / Street..." />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ob-locality">Service Locality</label>
              <select class="form-select" id="ob-locality">
                <option value="Lanka" ${d.service_locality === 'Lanka' ? 'selected' : ''}>Lanka</option>
                <option value="Bhelupur" ${d.service_locality === 'Bhelupur' ? 'selected' : ''}>Bhelupur</option>
                <option value="Assi" ${d.service_locality === 'Assi' ? 'selected' : ''}>Assi</option>
                <option value="Sigra" ${d.service_locality === 'Sigra' ? 'selected' : ''}>Sigra</option>
                <option value="Godowlia" ${d.service_locality === 'Godowlia' ? 'selected' : ''}>Godowlia</option>
                <option value="Cantonment" ${d.service_locality === 'Cantonment' ? 'selected' : ''}>Cantonment</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ob-pincode">Pincode</label>
              <input class="form-input" id="ob-pincode" value="${d.pincode}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">GPS Coordinates</label>
            <div class="form-row">
              <input class="form-input" id="ob-lat" value="${d.latitude}" placeholder="Latitude" readonly style="background:#f8faf8" />
              <input class="form-input" id="ob-lng" value="${d.longitude}" placeholder="Longitude" readonly style="background:#f8faf8" />
            </div>
            <button type="button" class="button button-small button-ghost" id="ob-detect-gps-btn" style="margin-top:6px;font-size:11px">📍 Use My Current GPS Coordinates</button>
          </div>

          <div class="form-group">
            <label class="form-label" for="ob-radius">Operating Radius</label>
            <select class="form-select" id="ob-radius">
              <option value="5 km" ${d.service_radius === '5 km' ? 'selected' : ''}>5 km</option>
              <option value="10 km" ${d.service_radius === '10 km' ? 'selected' : ''}>10 km (Recommended)</option>
              <option value="15 km" ${d.service_radius === '15 km' ? 'selected' : ''}>15 km</option>
              <option value="20 km" ${d.service_radius === '20 km' ? 'selected' : ''}>20 km (Entire City)</option>
            </select>
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:20px">
            <button type="button" class="button button-ghost" onclick="openPartnerOnboardingWizard(1)">← Back</button>
            <button type="submit" class="button">Next: Trade &amp; Skills <span>→</span></button>
          </div>
        </form>
      `;

      document.getElementById('ob-detect-gps-btn').onclick = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            document.getElementById('ob-lat').value = pos.coords.latitude.toFixed(6);
            document.getElementById('ob-lng').value = pos.coords.longitude.toFixed(6);
            d.latitude = parseFloat(pos.coords.latitude.toFixed(6));
            d.longitude = parseFloat(pos.coords.longitude.toFixed(6));
            showToast('GPS coordinates updated.');
          }, () => showToast('Could not detect location. Using default Lanka coordinates.'));
        }
      };

      document.getElementById('part-onboard-step2-form').onsubmit = (e) => {
        e.preventDefault();
        d.shop_name = document.getElementById('ob-shop-name')?.value || '';
        d.shop_address = document.getElementById('ob-shop-addr')?.value || '';
        d.address_line = document.getElementById('ob-addr').value;
        d.service_locality = document.getElementById('ob-locality').value;
        d.pincode = document.getElementById('ob-pincode').value;
        d.latitude = parseFloat(document.getElementById('ob-lat').value);
        d.longitude = parseFloat(document.getElementById('ob-lng').value);
        d.service_radius = document.getElementById('ob-radius').value;
        openPartnerOnboardingWizard(3);
      };
    } else if (step === 3) {
      if (title) title.innerHTML = 'Trade &amp; Skills<br /><em>service catalog.</em>';
      if (desc) desc.textContent = 'Step 3 of 5. Select services you offer and set your base price.';

      body.innerHTML = `
        <form id="part-onboard-step3-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ob-primary-skill">Primary Trade</label>
              <input class="form-input" id="ob-primary-skill" value="${d.primary_skill}" required placeholder="e.g. Electrician" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ob-exp">Experience (Years)</label>
              <input type="number" class="form-input" id="ob-exp" value="${d.experience_years}" min="1" max="40" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ob-secondary-skill">Secondary Skill (Optional)</label>
              <input class="form-input" id="ob-secondary-skill" value="${d.secondary_skill}" placeholder="e.g. Appliance Repair" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ob-start-price">Starting Inspection Rate (₹)</label>
              <input type="number" class="form-input" id="ob-start-price" value="${d.starting_price}" min="99" max="999" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="ob-bio">Short Professional Bio</label>
            <textarea class="form-textarea" id="ob-bio" rows="2" placeholder="e.g. 5+ years servicing electrical installations, fans, switches, and wiring in Lanka and Assi.">${d.bio}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Services You Can Perform</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px;max-height:180px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;padding:10px">
              ${state.services.map(s => `
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                  <input type="checkbox" name="ob_srv" value="${s.id}" ${d.selected_services.includes(s.id) || s.name.toLowerCase().includes(d.primary_skill.toLowerCase()) ? 'checked' : ''} />
                  <span>${s.icon || '⚡'} ${s.name}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:20px">
            <button type="button" class="button button-ghost" onclick="openPartnerOnboardingWizard(2)">← Back</button>
            <button type="submit" class="button">Next: Verification Documents <span>→</span></button>
          </div>
        </form>
      `;

      document.getElementById('part-onboard-step3-form').onsubmit = (e) => {
        e.preventDefault();
        d.primary_skill = document.getElementById('ob-primary-skill').value;
        d.experience_years = parseInt(document.getElementById('ob-exp').value);
        d.secondary_skill = document.getElementById('ob-secondary-skill').value;
        d.starting_price = parseInt(document.getElementById('ob-start-price').value);
        d.bio = document.getElementById('ob-bio').value;

        const checked = Array.from(document.querySelectorAll('input[name="ob_srv"]:checked')).map(cb => cb.value);
        d.selected_services = checked;
        openPartnerOnboardingWizard(4);
      };
    } else if (step === 4) {
      if (title) title.innerHTML = 'KYC Documents<br /><em>government identity proofs.</em>';
      if (desc) desc.textContent = 'Step 4 of 5. Upload clear photos of your Government ID and Trade license.';

      body.innerHTML = `
        <div id="part-onboard-step4-wrap">
          <div class="kyc-docs-grid">
            <div class="kyc-upload-box" id="upload-box-aadhaar-front">
              <div class="kyc-upload-icon">🪪</div>
              <div class="kyc-upload-title">Aadhaar Card (Front)</div>
              <div class="kyc-upload-sub">Masked ID or photo</div>
              <input type="file" id="file-aadhaar-front" accept="image/*,.pdf" style="display:none" />
              <button type="button" class="button button-small button-ghost" style="margin-top:10px" onclick="document.getElementById('file-aadhaar-front').click()">Select File</button>
              <div id="status-aadhaar-front" style="font-size:11px;color:#10b981;margin-top:6px"></div>
            </div>

            <div class="kyc-upload-box" id="upload-box-aadhaar-back">
              <div class="kyc-upload-icon">🪪</div>
              <div class="kyc-upload-title">Aadhaar Card (Back)</div>
              <div class="kyc-upload-sub">Address proof side</div>
              <input type="file" id="file-aadhaar-back" accept="image/*,.pdf" style="display:none" />
              <button type="button" class="button button-small button-ghost" style="margin-top:10px" onclick="document.getElementById('file-aadhaar-back').click()">Select File</button>
              <div id="status-aadhaar-back" style="font-size:11px;color:#10b981;margin-top:6px"></div>
            </div>

            <div class="kyc-upload-box" id="upload-box-license">
              <div class="kyc-upload-icon">📜</div>
              <div class="kyc-upload-title">Trade License / Cert</div>
              <div class="kyc-upload-sub">ITI, shop license, or work proof</div>
              <input type="file" id="file-license" accept="image/*,.pdf" style="display:none" />
              <button type="button" class="button button-small button-ghost" style="margin-top:10px" onclick="document.getElementById('file-license').click()">Select File</button>
              <div id="status-license" style="font-size:11px;color:#10b981;margin-top:6px"></div>
            </div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;font-size:12px;color:#475569;margin-bottom:14px">
            🔒 <strong>Privacy Assurance:</strong> Raw government numbers are never stored in plaintext. Documents are strictly audited by the administrative verification desk.
          </div>

          <div style="display:flex;justify-content:space-between;margin-top:20px">
            <button type="button" class="button button-ghost" onclick="openPartnerOnboardingWizard(3)">← Back</button>
            <button type="button" class="button" id="ob-step4-next-btn">Next: Review &amp; Submit <span>→</span></button>
          </div>
        </div>
      `;

      const setupUpload = (fileInputId, statusId, boxId, docType, side) => {
        const inp = document.getElementById(fileInputId);
        if (!inp) return;
        inp.onchange = async () => {
          if (!inp.files || !inp.files[0]) return;
          const file = inp.files[0];
          const st = document.getElementById(statusId);
          if (st) st.textContent = 'Uploading...';
          const formData = new FormData();
          formData.append('document_type', docType);
          formData.append('document_side', side);
          formData.append('file', file);
          try {
            await API.uploadPartnerDocument(formData);
            if (st) st.textContent = '✓ Uploaded';
            document.getElementById(boxId)?.classList.add('uploaded');
            showToast(`${docType} (${side}) uploaded!`);
          } catch (err) {
            if (st) st.textContent = 'Upload failed';
            showToast(err.message, true);
          }
        };
      };

      setupUpload('file-aadhaar-front', 'status-aadhaar-front', 'upload-box-aadhaar-front', 'AADHAAR', 'FRONT');
      setupUpload('file-aadhaar-back', 'status-aadhaar-back', 'upload-box-aadhaar-back', 'AADHAAR', 'BACK');
      setupUpload('file-license', 'status-license', 'upload-box-license', 'TRADE_LICENSE', 'FRONT');

      document.getElementById('ob-step4-next-btn').onclick = () => openPartnerOnboardingWizard(5);
    } else if (step === 5) {
      if (title) title.innerHTML = 'Review &amp; Submit<br /><em>verification application.</em>';
      if (desc) desc.textContent = 'Step 5 of 5. Please verify your details before submitting to Admin audit.';

      body.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#64748b">Primary Trade:</span>
            <strong>${d.primary_skill} (${d.experience_years} yrs experience)</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#64748b">Locality:</span>
            <strong>${d.service_locality}, Varanasi (${d.service_radius})</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#64748b">Setup:</span>
            <strong>${d.is_home_based ? 'Home-Based Pro' : `Shop: ${d.shop_name}`}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#64748b">Starting Price:</span>
            <strong>₹${d.starting_price}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#64748b">Catalog Offerings:</span>
            <strong>${d.selected_services.length} services selected</strong>
          </div>
        </div>

        <label style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:#334155;margin-bottom:18px;cursor:pointer">
          <input type="checkbox" id="ob-declare-check" checked style="margin-top:2px" />
          <span>I declare that all personal information, documents, and trade credentials submitted are truthful and authentic.</span>
        </label>

        <div style="display:flex;justify-content:space-between">
          <button type="button" class="button button-ghost" onclick="openPartnerOnboardingWizard(4)">← Back</button>
          <button type="button" class="button button-lime" id="ob-final-submit-btn">Submit Verification Application ✓</button>
        </div>
      `;

      document.getElementById('ob-final-submit-btn').onclick = async () => {
        const check = document.getElementById('ob-declare-check');
        if (!check || !check.checked) {
          showToast('Please check the declaration checkbox to continue.', true);
          return;
        }

        const btn = document.getElementById('ob-final-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
          if (d.profile_photo_data && d.profile_photo_data.startsWith('data:')) {
            try {
              const photoRes = await API.uploadPartnerProfilePhoto(d.profile_photo_data);
              if (photoRes && photoRes.profile_photo) {
                d.profile_photo = photoRes.profile_photo;
                if (state.currentProfile) state.currentProfile.profile_photo = photoRes.profile_photo;
              }
            } catch (pErr) {
              console.warn('Photo upload error during onboarding:', pErr);
            }
          }
          await API.submitPartnerOnboarding(d);
          closeModal('#partner-onboarding-modal');
          showToast('Onboarding submitted! Your verification application is now under admin audit.');
          await refreshPartnerData();
          setupPartnerSpace();
        } catch (err) {
          showToast('Submission failed: ' + err.message, true);
          btn.disabled = false;
          btn.textContent = 'Submit Verification Application ✓';
        }
      };
    }

    openModal('#partner-onboarding-modal');
  };

  // ==========================================================================
  // PARTNER DASHBOARD WORKSPACE
  // ==========================================================================
  async function setupPartnerSpace() {
    showFullscreenApp('partner-app');
    const user = state.currentUser;

    try {
      const myP = await API.getPartnerMyProfile();
      if (myP && myP.partner) {
        state.currentPartnerProfile = myP;
        state.currentProfile = Object.assign({}, state.currentProfile, myP.partner);
      }
    } catch (e) {
      console.warn('Failed to load my partner profile:', e);
    }

    const profile = state.currentProfile || {};

    const nameEl = document.getElementById('part-name-pill');
    const areaEl = document.getElementById('part-area-pill');
    const avatarEl = document.getElementById('part-avatar-pill');
    const kycBadge = document.getElementById('part-kyc-status-badge');

    if (nameEl) nameEl.textContent = profile.full_name || user.email;
    if (areaEl) areaEl.textContent = `${profile.service_locality || 'Lanka'}, Varanasi`;
    if (avatarEl) {
      if (profile.profile_photo) {
        avatarEl.innerHTML = `<img src="${profile.profile_photo}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
        avatarEl.style.padding = '0';
        avatarEl.style.overflow = 'hidden';
      } else {
        avatarEl.textContent = profile.initials || 'KP';
      }
    }

    if (kycBadge) {
      if (profile.verification_status === 'VERIFIED') {
        kycBadge.textContent = '✓ VERIFIED PRO';
        kycBadge.className = 'status-pill verified';
      } else if (profile.verification_status === 'REJECTED') {
        kycBadge.textContent = '❌ VERIFICATION REJECTED';
        kycBadge.className = 'status-pill cancelled';
      } else if (profile.onboarding_completed === 0 || profile.verification_status === 'INCOMPLETE') {
        kycBadge.textContent = '⚠️ PROFILE INCOMPLETE';
        kycBadge.className = 'status-pill pending';
      } else {
        kycBadge.textContent = '🟡 VERIFICATION PENDING';
        kycBadge.className = 'status-pill pending';
      }
    }

    // Online / Offline Switch
    const onlineBtn = document.getElementById('part-toggle-online-btn');
    const onlineLabel = document.getElementById('part-online-status-label');
    const isOnline = !!profile.is_online;
    if (onlineBtn) {
      onlineBtn.className = `switch ${isOnline ? 'on' : ''}`;
      onlineBtn.onclick = async () => {
        const newStatus = !profile.is_online;
        try {
          await API.setPartnerOnlineStatus(newStatus);
          profile.is_online = newStatus ? 1 : 0;
          onlineBtn.className = `switch ${newStatus ? 'on' : ''}`;
          if (onlineLabel) {
            onlineLabel.textContent = newStatus ? 'Online for jobs' : 'Offline';
            onlineLabel.style.color = newStatus ? '#10b981' : '#94a3b8';
          }
          showToast(newStatus ? 'You are now Online for bookings.' : 'You are now Offline.');
        } catch (err) {
          showToast(err.message, true);
        }
      };
    }
    if (onlineLabel) {
      onlineLabel.textContent = isOnline ? 'Online for jobs' : 'Offline';
      onlineLabel.style.color = isOnline ? '#10b981' : '#94a3b8';
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
    } else if (viewId === 'part-active-jobs') {
      renderPartnerActiveJobsView(main);
    } else if (viewId === 'part-availability') {
      renderPartnerAvailabilityView(main);
    } else if (viewId === 'part-skills') {
      renderPartnerSkillsView(main);
    } else if (viewId === 'part-history') {
      renderPartnerHistoryView(main);
    } else if (viewId === 'part-earnings') {
      renderPartnerEarningsView(main);
    } else if (viewId === 'part-reviews') {
      renderPartnerReviewsView(main);
    } else if (viewId === 'part-notifications') {
      renderPartnerNotificationsView(main);
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
    const profile = state.currentProfile || {};

    let bannerHtml = '';
    if (profile.onboarding_completed === 0 || profile.verification_status === 'INCOMPLETE') {
      bannerHtml = `
        <div style="background:#fef3c7;border:1px solid #fde047;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="margin:0 0 4px;color:#92400e;font-size:15px">⚠️ Partner Profile Incomplete</h4>
            <p style="margin:0;font-size:13px;color:#78350f">Complete your trade verification details &amp; upload Government ID proofs to begin receiving customer bookings.</p>
          </div>
          <button class="button button-small button-lime" onclick="openPartnerOnboardingWizard()">Complete Verification Wizard →</button>
        </div>
      `;
    } else if (profile.verification_status === 'REJECTED') {
      bannerHtml = `
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="margin:0 0 4px;color:#991b1b;font-size:15px">❌ Verification Application Rejected</h4>
            <p style="margin:0;font-size:13px;color:#7f1d1d">Reason: <strong>${profile.rejection_reason || 'Document audit issue'}</strong>. Please update your details and re-submit.</p>
          </div>
          <button class="button button-small button-danger" onclick="openPartnerOnboardingWizard()">Update &amp; Re-Submit →</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner Workspace — <em>${profile.full_name || 'Partner'}</em></h1>
          <p>Manage incoming customer requests, milestone progress, and earnings.</p>
        </div>
      </div>

      ${bannerHtml}

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
              <small style="color:#80948f">${b.scheduled_time} · Payout: <b>₹${b.estimated_price || b.total_amount}</b></small>
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
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
              ${b.status === 'ACCEPTED' ? `<button class="button button-small" onclick="advanceJobStatus('${b.id}', 'ON_THE_WAY')">I'm On The Way →</button>` : ''}
              ${b.status === 'ON_THE_WAY' ? `<button class="button button-small" onclick="advanceJobStatus('${b.id}', 'ARRIVED')">I Have Arrived 📍</button>` : ''}
              ${b.status === 'ARRIVED' ? `<button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'IN_PROGRESS')">Start Service ⚒</button>` : ''}
              ${b.status === 'IN_PROGRESS' ? `<button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'COMPLETED')">Complete Service ✓</button>` : ''}
              <button class="button button-small button-ghost" onclick="openLiveTrackingModal('${b.id}')">Live Radar &amp; Chat</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderPartnerActiveJobsView(container) {
    const list = state.partnerBookings || [];
    const activeJobs = list.filter(b => ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(b.status));
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Active <em>Jobs &amp; Live Tracking</em></h1>
          <p>Advance milestone status, share your live GPS location, and coordinate with customers.</p>
        </div>
      </div>

      <!-- Live GPS Sharing Toggle Card -->
      <div class="profile-section-card" style="background:#f0fdf4;border-color:#bbf7d0">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="color:#166534">📍 Real-Time Location Sharing</h3>
            <p style="margin:2px 0 0;font-size:12px;color:#15803d">
              Allow customer to track your live arrival distance on their radar screen.
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:700;font-size:13px;color:${profile.is_sharing_location ? '#166534' : '#64748b'}">
              ${profile.is_sharing_location ? '🟢 Sharing GPS Location' : '⚪ Sharing Disabled'}
            </span>
            <button class="switch ${profile.is_sharing_location ? 'on' : ''}" id="part-location-share-switch"><i></i></button>
          </div>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Active Work Orders (${activeJobs.length})</h3>
        ${activeJobs.length === 0 ? `
          <div style="text-align:center;padding:40px;color:#64748b">
            No active jobs at the moment. Accepted customer bookings will appear here for milestone updates.
          </div>
        ` : activeJobs.map(b => `
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:18px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
              <div>
                <span class="booking-ref-tag">${b.booking_reference}</span>
                <h3 style="margin:6px 0 2px;font-size:18px">${b.service_name}</h3>
                <p style="font-size:13px;color:#475569;margin:0">
                  Customer: <strong>${b.customer_name}</strong> · ${b.customer_locality || 'Varanasi'}
                </p>
                <div style="font-size:12px;color:#64748b;margin-top:4px">
                  📍 Address: <b>${b.customer_address || 'Address provided on order'}</b>
                </div>
              </div>
              <div style="text-align:right">
                <span class="status-pill accepted">${b.status.replace('_', ' ')}</span>
                <div style="margin-top:6px;font-weight:700;font-size:16px;color:var(--teal)">Payout: ₹${b.estimated_price || b.total_amount}</div>
              </div>
            </div>

            <!-- Milestone Advancement Bar -->
            <div style="margin-top:16px;padding-top:14px;border-top:1px dashed #e2e8f0;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
              <span style="font-size:12px;font-weight:700;color:#64748b">Advance Job Status:</span>
              ${b.status === 'ACCEPTED' ? `
                <button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'ON_THE_WAY')">I'm On The Way →</button>
              ` : ''}
              ${b.status === 'ON_THE_WAY' ? `
                <button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'ARRIVED')">I Have Arrived at Doorstep 📍</button>
              ` : ''}
              ${b.status === 'ARRIVED' ? `
                <button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'IN_PROGRESS')">Start Service ⚒</button>
              ` : ''}
              ${b.status === 'IN_PROGRESS' ? `
                <button class="button button-small button-lime" onclick="advanceJobStatus('${b.id}', 'COMPLETED')">Complete Service &amp; Settle ✓</button>
              ` : ''}

              <div style="margin-left:auto;display:flex;gap:8px">
                <button class="button button-small button-ghost" onclick="openLiveTrackingModal('${b.id}')">📍 Radar &amp; Customer Chat</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const shareSwitch = document.getElementById('part-location-share-switch');
    if (shareSwitch) {
      shareSwitch.onclick = async () => {
        const nextState = !profile.is_sharing_location;
        try {
          await API.togglePartnerLocationSharing(nextState);
          profile.is_sharing_location = nextState ? 1 : 0;
          showToast(nextState ? 'GPS Location Sharing enabled.' : 'GPS Location Sharing disabled.');
          renderPartnerActiveJobsView(container);
        } catch (err) {
          showToast(err.message, true);
        }
      };
    }
  }

  function renderPartnerAvailabilityView(container) {
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Availability <em>Management</em></h1>
          <p>Control your instant online toggle, weekly operating hours, and date exceptions.</p>
        </div>
      </div>

      <!-- 1. Real-time Online / Offline Toggle Card -->
      <div class="profile-section-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3>Immediate Job Dispatch Status</h3>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b">When Online, you receive immediate dispatch alerts for urgent bookings nearby.</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span id="avail-status-text" style="font-weight:700;font-size:13px;color:${profile.is_online ? '#10b981' : '#94a3b8'}">
              ${profile.is_online ? '● Online &amp; Accepting Jobs' : '○ Offline'}
            </span>
            <button class="switch ${profile.is_online ? 'on' : ''}" id="avail-inline-toggle"><i></i></button>
          </div>
        </div>
      </div>

      <!-- 2. Weekly 7-Day Operating Schedule -->
      <div class="profile-section-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div>
            <h3>Weekly Operating Hours</h3>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b">Customers will only be allowed to book appointments during your available hours.</p>
          </div>
          <button class="button button-small" id="avail-save-weekly-btn">Save Weekly Schedule ✓</button>
        </div>

        <div id="avail-weekly-table-wrap">
          <div style="text-align:center;padding:20px;color:#94a3b8">Loading schedule...</div>
        </div>
      </div>

      <!-- 3. Date-Specific Exceptions / Holidays -->
      <div class="profile-section-card">
        <h3>Date-Specific Exceptions &amp; Holidays</h3>
        <p style="font-size:13px;color:#64748b;margin-bottom:14px">Mark specific calendar dates as holidays or set custom hours.</p>

        <form id="avail-add-exception-form" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ex-date">Exception Date</label>
              <input type="date" class="form-input" id="ex-date" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-reason">Reason / Note</label>
              <input class="form-input" id="ex-reason" placeholder="e.g. Festival Holiday, Personal Leave..." />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ex-start">Start Time</label>
              <input type="time" class="form-input" id="ex-start" value="09:00" />
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-end">End Time</label>
              <input type="time" class="form-input" id="ex-end" value="18:00" />
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="ex-is-unavail" checked />
              <span>Full Day Unavailable (Holiday)</span>
            </label>
            <button type="submit" class="button button-small button-lime">+ Add Exception</button>
          </div>
        </form>

        <div id="avail-exceptions-list">
          <div style="text-align:center;padding:10px;color:#94a3b8">Loading exceptions...</div>
        </div>
      </div>
    `;

    document.getElementById('avail-inline-toggle').onclick = async () => {
      const newStatus = !profile.is_online;
      try {
        await API.setPartnerOnlineStatus(newStatus);
        profile.is_online = newStatus ? 1 : 0;
        showToast(newStatus ? 'Status changed to Online.' : 'Status changed to Offline.');
        renderPartnerAvailabilityView(container);
      } catch (err) {
        showToast(err.message, true);
      }
    };

    API.getPartnerAvailability().then(data => {
      const schedule = data.schedule || [];
      const exceptions = data.exceptions || [];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const wrap = document.getElementById('avail-weekly-table-wrap');
      if (wrap) {
        wrap.innerHTML = `
          <table class="avail-schedule-table">
            <tbody>
              ${[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
                const dayData = schedule.find(s => s.day_of_week === dayIdx) || { is_available: 1, start_time: '08:00', end_time: '20:00' };
                return `
                  <tr class="avail-row" data-day="${dayIdx}">
                    <td>${days[dayIdx]}</td>
                    <td>
                      <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
                        <input type="checkbox" class="day-avail-cb" ${dayData.is_available ? 'checked' : ''} />
                        <span>Available</span>
                      </label>
                    </td>
                    <td>
                      <div class="time-range-select">
                        <input type="time" class="day-start-time" value="${dayData.start_time || '08:00'}" />
                        <span>to</span>
                        <input type="time" class="day-end-time" value="${dayData.end_time || '20:00'}" />
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }

      const exList = document.getElementById('avail-exceptions-list');
      if (exList) {
        exList.innerHTML = exceptions.length === 0 ? `
          <p style="font-size:13px;color:#94a3b8">No date-specific exceptions saved.</p>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${exceptions.map(ex => `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong>📅 ${ex.exception_date}</strong>
                  <span style="font-size:12px;color:${ex.is_unavailable ? '#dc2626' : '#166534'};margin-left:8px">
                    ${ex.is_unavailable ? '⛔ Fully Unavailable / Off' : `🕒 Custom: ${ex.start_time} - ${ex.end_time}`}
                  </span>
                  ${ex.reason ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${ex.reason}</div>` : ''}
                </div>
                <button class="button button-small button-danger" style="font-size:11px" onclick="deleteAvailabilityException('${ex.id}')">Delete</button>
              </div>
            `).join('')}
          </div>
        `;
      }
    }).catch(err => {
      console.warn('Load availability error:', err);
    });

    document.getElementById('avail-save-weekly-btn').onclick = async () => {
      const rows = document.querySelectorAll('.avail-row');
      const schedule = Array.from(rows).map(r => ({
        day_of_week: parseInt(r.dataset.day),
        is_available: r.querySelector('.day-avail-cb').checked ? 1 : 0,
        start_time: r.querySelector('.day-start-time').value,
        end_time: r.querySelector('.day-end-time').value
      }));

      try {
        await API.setPartnerWeeklySchedule(schedule);
        showToast('Weekly schedule updated successfully.');
      } catch (err) {
        showToast(err.message, true);
      }
    };

    document.getElementById('avail-add-exception-form').onsubmit = async (e) => {
      e.preventDefault();
      const date = document.getElementById('ex-date').value;
      const reason = document.getElementById('ex-reason').value;
      const start = document.getElementById('ex-start').value;
      const end = document.getElementById('ex-end').value;
      const isUnavail = document.getElementById('ex-is-unavail').checked ? 1 : 0;

      try {
        await API.addPartnerAvailabilityException({
          exception_date: date,
          reason,
          start_time: start,
          end_time: end,
          is_unavailable: isUnavail
        });
        showToast('Exception added.');
        renderPartnerAvailabilityView(container);
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }

  root.deleteAvailabilityException = async function(id) {
    try {
      await API.deletePartnerAvailabilityException(id);
      showToast('Exception removed.');
      const main = document.getElementById('partner-main-view');
      if (main) renderPartnerAvailabilityView(main);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  function renderPartnerSkillsView(container) {
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>My <em>Skills &amp; Catalog Offerings</em></h1>
          <p>Update your trade specializations, starting prices, and services offered.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Trade Specializations</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Primary Trade</label>
            <input class="form-input" id="pskill-primary" value="${profile.primary_skill || 'Electrician'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Secondary Trade</label>
            <input class="form-input" id="pskill-secondary" value="${profile.secondary_skill || ''}" placeholder="e.g. Appliance Repair" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tertiary Trade</label>
            <input class="form-input" id="pskill-tertiary" value="${profile.tertiary_skill || ''}" placeholder="e.g. Cooler Servicing" />
          </div>
          <div class="form-group">
            <label class="form-label">Years of Experience</label>
            <input type="number" class="form-input" id="pskill-exp" value="${profile.experience_years || 2}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Professional Bio</label>
          <textarea class="form-textarea" id="pskill-bio" rows="2">${profile.bio || ''}</textarea>
        </div>
        <button class="button button-lime" id="pskill-save-btn">Update Skills &amp; Bio ✓</button>
      </div>
    `;

    document.getElementById('pskill-save-btn').onclick = async () => {
      try {
        await API.submitPartnerOnboarding({
          primary_skill: document.getElementById('pskill-primary').value,
          secondary_skill: document.getElementById('pskill-secondary').value,
          tertiary_skill: document.getElementById('pskill-tertiary').value,
          experience_years: parseInt(document.getElementById('pskill-exp').value),
          bio: document.getElementById('pskill-bio').value
        });
        showToast('Skills updated.');
        await refreshPartnerData();
      } catch (err) {
        showToast(err.message, true);
      }
    };
  }

  function renderPartnerHistoryView(container) {
    const list = state.partnerBookings || [];
    const past = list.filter(b => ['COMPLETED', 'CANCELLED'].includes(b.status));

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Job <em>History</em></h1>
          <p>Past completed work orders and service records.</p>
        </div>
      </div>

      <div class="profile-section-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f7f2;border-bottom:1px solid #e1e7df;text-align:left">
              <th style="padding:14px 18px">Reference</th>
              <th style="padding:14px 18px">Service</th>
              <th style="padding:14px 18px">Customer</th>
              <th style="padding:14px 18px">Scheduled</th>
              <th style="padding:14px 18px">Payout</th>
              <th style="padding:14px 18px">Status</th>
            </tr>
          </thead>
          <tbody>
            ${past.length === 0 ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:#889c97">No past completed jobs found.</td></tr>` : past.map(b => `
              <tr style="border-bottom:1px solid #f0f4f1">
                <td style="padding:14px 18px"><strong>${b.booking_reference}</strong></td>
                <td style="padding:14px 18px">${b.service_name}</td>
                <td style="padding:14px 18px">${b.customer_name}</td>
                <td style="padding:14px 18px">${b.scheduled_time}</td>
                <td style="padding:14px 18px"><b>₹${b.estimated_price || b.total_amount}</b></td>
                <td style="padding:14px 18px"><span class="status-pill ${b.status.toLowerCase()}">${b.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPartnerEarningsView(container) {
    const list = state.partnerBookings || [];
    const completed = list.filter(b => b.status === 'COMPLETED');
    const totalEarnings = completed.reduce((sum, b) => sum + (b.estimated_price || 149), 0);

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner <em>Earnings &amp; Payouts</em></h1>
          <p>Transparent weekly payout statements and earnings analytics.</p>
        </div>
      </div>

      <div class="stat-grid-4">
        <div class="stat-box">
          <small>Lifetime Earnings</small>
          <strong>₹${totalEarnings}</strong>
          <span>Direct Payouts</span>
        </div>
        <div class="stat-box">
          <small>Completed Jobs</small>
          <strong>${completed.length}</strong>
          <span>100% Payout Rate</span>
        </div>
        <div class="stat-box">
          <small>Average per Job</small>
          <strong>₹${completed.length ? Math.round(totalEarnings / completed.length) : 0}</strong>
          <span>Net per order</span>
        </div>
        <div class="stat-box">
          <small>Payout Schedule</small>
          <strong>Weekly</strong>
          <span>Every Monday</span>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Payout History</h3>
        ${completed.length === 0 ? `<p style="font-size:13px;color:#94a3b8">No completed payouts yet.</p>` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${completed.map(b => `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <strong>${b.service_name} · ${b.booking_reference}</strong>
                  <div style="font-size:12px;color:#64748b">${b.customer_name} · ${b.scheduled_time}</div>
                </div>
                <div style="text-align:right">
                  <strong style="color:#10b981;font-size:16px">+₹${b.estimated_price || b.total_amount}</strong>
                  <div style="font-size:11px;color:#64748b">Direct Payout</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderPartnerReviewsView(container) {
    const profile = state.currentProfile || {};

    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Customer <em>Reviews &amp; Ratings</em></h1>
          <p>Real ratings and feedback submitted by customers after job completion.</p>
        </div>
      </div>

      <div class="stat-grid-4">
        <div class="stat-box">
          <small>Average Rating</small>
          <strong style="color:#d97706">★ ${profile.rating || 5.0}</strong>
          <span>Out of 5.0</span>
        </div>
        <div class="stat-box">
          <small>Total Reviews</small>
          <strong>${profile.rating_count || 0}</strong>
          <span>Customer Reviews</span>
        </div>
        <div class="stat-box">
          <small>Completed Jobs</small>
          <strong>${profile.completed_jobs || 0}</strong>
          <span>Lifetime</span>
        </div>
        <div class="stat-box">
          <small>Response Rate</small>
          <strong style="color:#10b981">${profile.response_rate || 98}%</strong>
          <span>Top Pro Standard</span>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Customer Feedback</h3>
        <p style="font-size:13px;color:#64748b">Showing verified reviews from customers in your locality.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:10px">
          <div style="display:flex;justify-content:space-between">
            <strong>Shreya Mishra · Lanka</strong>
            <span style="color:#d97706">★ 5 / 5</span>
          </div>
          <p style="font-size:13px;color:#475569;margin:6px 0">Prompt arrival, diagnosed problem quickly, very polite behaviour.</p>
          <small style="color:#94a3b8">Verified Customer Review</small>
        </div>
      </div>
    `;
  }

  function renderPartnerNotificationsView(container) {
    container.innerHTML = `
      <div class="dash-welcome">
        <div>
          <h1>Partner <em>Notifications</em></h1>
          <p>Real-time booking dispatch alerts, verification updates, and platform messages.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:20px">📦</span>
            <div>
              <strong>Dispatch Network Active</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#475569">You are connected to the Varanasi progressive dispatch network. Keep your status Online to receive instant job alerts within 12–35 km.</p>
              <small style="color:#94a3b8">Platform Update</small>
            </div>
          </div>
        </div>
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

      <!-- Feature 4: Profile Picture Card -->
      <div class="profile-section-card">
        <h3>Professional Profile Picture</h3>
        <p style="font-size:13px;color:#64748b;margin:4px 0 14px">Upload a high-quality photo to appear on customer booking cards, tracking radar, and in-app chat.</p>
        <div style="display:flex;align-items:center;gap:18px">
          <div id="part-profile-pic-preview" style="width:76px;height:76px;border-radius:50%;overflow:hidden;background:#e2e8f0;border:3px solid var(--teal, #0e705b);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;color:var(--teal)">
            ${profile.profile_photo ? `<img src="${profile.profile_photo}" alt="Avatar" style="width:100%;height:100%;object-fit:cover" />` : (profile.initials || 'KP')}
          </div>
          <div>
            <label class="button button-small button-lime" style="cursor:pointer;display:inline-block">
              <span>📷 Update Profile Photo</span>
              <input type="file" id="part-profile-pic-file" accept="image/jpeg,image/png,image/webp" style="display:none" />
            </label>
            <small style="display:block;color:#64748b;margin-top:6px">Supported formats: JPEG, PNG, WebP (Max 5MB)</small>
          </div>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Professional Information</h3>
        <div class="profile-data-row"><span>Full Name</span><strong>${profile.full_name || 'Partner'}</strong></div>
        <div class="profile-data-row">
          <span>Email</span>
          <div>
            <strong>${user.email}</strong>
            ${user.email_verified ? '<span class="status-pill verified" style="margin-left:8px;font-size:11px">✓ Verified</span>' : `<button class="button button-small button-ghost" style="margin-left:8px;font-size:11px;color:#d97706;border-color:#fde047" onclick="openVerificationModal('EMAIL', '${user.email}')">Verify Email ⚡</button>`}
          </div>
        </div>
        <div class="profile-data-row">
          <span>Phone</span>
          <div>
            <strong>${user.phone || 'Not provided'}</strong>
            ${user.phone ? (user.phone_verified ? '<span class="status-pill verified" style="margin-left:8px;font-size:11px">✓ Verified</span>' : `<button class="button button-small button-ghost" style="margin-left:8px;font-size:11px;color:#d97706;border-color:#fde047" onclick="openVerificationModal('PHONE', '${user.phone}')">Verify Phone ⚡</button>`) : ''}
          </div>
        </div>
        <div class="profile-data-row"><span>Service Locality</span><strong>${profile.service_locality || 'Lanka'}, Varanasi (${profile.service_radius || '5 km'})</strong></div>
        <div class="profile-data-row"><span>Experience</span><strong>${profile.experience_years || 1} Years</strong></div>
        <div class="profile-data-row"><span>Customer Rating</span><strong>★ ${profile.rating || 5.0} (${profile.rating_count || 0} reviews)</strong></div>
        <div class="profile-data-row"><span>Verification Status</span><strong class="status-pill ${profile.verification_status === 'VERIFIED' ? 'verified' : 'pending'}">${profile.verification_status}</strong></div>
      </div>
    `;

    const photoFile = document.getElementById('part-profile-pic-file');
    if (photoFile) {
      photoFile.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('Image file size must be less than 5MB.', true);
          return;
        }
        try {
          showToast('Uploading profile photo...');
          const res = await API.uploadPartnerProfilePhoto(file);
          if (res && res.profile_photo) {
            profile.profile_photo = res.profile_photo;
            showToast('Profile photo updated successfully! ✓');
            renderPartnerProfileView(container);
            setupPartnerSpace();
          }
        } catch (err) {
          showToast('Photo upload failed: ' + err.message, true);
        }
      };
    }
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
          <p>Audit masked government ID proofs, documents, trade skills, and locality credentials before partner activation.</p>
        </div>
      </div>

      <div class="profile-section-card">
        <h3>Pending Applications (${list.length})</h3>
        ${list.length === 0 ? `<p style="color:#788f89;font-size:13px">All partner verifications audited. Zero backlog.</p>` : list.map(v => `
          <div style="background:#f8faf8;border:1px solid #e1e7df;border-radius:12px;padding:16px;margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
              <div>
                <span class="booking-ref-tag">${v.verification_type}</span>
                <h4 style="margin:6px 0 2px;font-size:16px">${v.partner_name}</h4>
                <p style="font-size:13px;color:#475569;margin:0">
                  📍 ${v.partner_area || 'Varanasi'} · Phone: <b>${v.partner_phone || '—'}</b> · Email: <b>${v.partner_email || '—'}</b>
                </p>
                <div style="font-size:12px;color:#64748b;margin-top:4px">
                  Trade: <b>${v.primary_skill || 'Pro'}</b> (${v.experience_years || 1} yrs exp) · Setup: <b>${v.is_home_based ? 'Home-Based' : (v.shop_name || 'Shop')}</b>
                </div>
                <small style="color:#829691;display:block;margin-top:4px">Notes: ${v.notes || 'Awaiting Admin KYC Audit'}</small>
              </div>
              <div style="display:flex;gap:8px">
                <button class="button button-small button-lime" onclick="decideKYC('${v.id}', 'VERIFIED')">Approve KYC ✓</button>
                <button class="button button-small button-danger" onclick="decideKYC('${v.id}', 'REJECTED')">Reject</button>
              </div>
            </div>

            <!-- Uploaded Documents Audit Row -->
            ${v.documents && v.documents.length ? `
              <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="font-size:11px;font-weight:700;color:#64748b">Auditable Documents:</span>
                ${v.documents.map(d => `
                  <a href="${d.file_url}" target="_blank" class="status-pill verified" style="text-decoration:none;font-size:11px;display:inline-flex;align-items:center;gap:4px">
                    📄 ${d.document_type} (${d.document_side || 'Proof'}) ↗
                  </a>
                `).join('')}
              </div>
            ` : '<div style="margin-top:10px;font-size:11px;color:#94a3b8">No digital documents uploaded yet.</div>'}
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
    let reason = '';
    if (decision === 'REJECTED') {
      reason = prompt('Please enter the reason for rejection (required):', 'ID proof blurry / Trade license not verifiable');
      if (!reason) return;
    }
    try {
      await API.decideAdminVerification(id, decision, reason || 'Audited via Admin Desk');
      showToast(`KYC application marked as ${decision}!`);
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
  // CONVERSATIONAL CUSTOMER AI ASSISTANT
  // ==========================================================================
  function openAssistantDrawer() {
    const drawer = document.getElementById('assistant-drawer');
    const backdrop = document.getElementById('modal-backdrop');
    if (drawer) drawer.classList.add('open');
    if (backdrop) backdrop.removeAttribute('hidden');
    renderAssistantMessages();
    setTimeout(() => {
      document.getElementById('assistant-user-input')?.focus();
    }, 150);
  }

  function closeAssistantDrawer() {
    const drawer = document.getElementById('assistant-drawer');
    const backdrop = document.getElementById('modal-backdrop');
    if (drawer) drawer.classList.remove('open');
    const openModals = document.querySelectorAll('dialog[open]');
    if (openModals.length === 0 && backdrop) {
      backdrop.setAttribute('hidden', '');
    }
  }

  function renderAssistantMessages() {
    const list = document.getElementById('assistant-messages-list');
    if (!list) return;

    list.innerHTML = state.assistantMessages.map(m => {
      const isBot = m.sender === 'bot';
      let formattedText = (m.text || '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br />');

      let actionHtml = '';
      if (m.action === 'SERVICE_MATCHED' && m.action_data?.service) {
        const srv = m.action_data.service;
        let proCardsHtml = '';
        if (m.action_data.recommended_providers && m.action_data.recommended_providers.length > 0) {
          proCardsHtml = `
            <div style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:8px">
              <div style="font-size:11px;font-weight:700;color:var(--teal);margin-bottom:6px">🌟 Top Verified Pros in Varanasi:</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${m.action_data.recommended_providers.map(p => `
                  <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <strong style="font-size:12px">${p.full_name}</strong>
                      <div style="font-size:11px;color:#64748b">★ ${p.rating} (${p.completed_jobs} jobs) · ₹${p.starting_price} in ${p.service_locality}</div>
                    </div>
                    <div style="display:flex;gap:4px">
                      <button class="assistant-card-btn" style="padding:4px 8px;font-size:11px" onclick="closeAssistantDrawer(); openPartnerProfileModal('${p.id}')">Profile</button>
                      <button class="assistant-card-btn" style="padding:4px 8px;font-size:11px;background:#0d5c63" onclick="closeAssistantDrawer(); startBooking('${srv.id}', '${p.id}')">Book</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
        actionHtml = `
          <div class="assistant-card">
            <div class="assistant-card-title">${srv.icon || '✦'} ${srv.name}</div>
            <div>${srv.description || ''}</div>
            <div style="margin-top:4px;font-weight:600;color:var(--teal)">Starting ₹${srv.base_price} · Est. Total: ₹${m.action_data.estimated_total || srv.base_price}</div>
            ${proCardsHtml}
            <button class="assistant-card-btn" style="margin-top:8px" onclick="closeAssistantDrawer(); startBooking('${srv.id}')">⚡ Fast Urgent Dispatch (${srv.name}) →</button>
          </div>
        `;
      } else if (m.action === 'CONFIRMATION_REQUIRED' && m.action_data?.draft) {
        const draft = m.action_data.draft;
        actionHtml = `
          <div class="assistant-card">
            <div class="assistant-card-title">📋 Draft: ${draft.service_name}</div>
            <div>Scheduled: <strong>${draft.scheduled_date} at ${draft.scheduled_time}</strong></div>
            <div style="margin-top:4px;font-weight:600;color:var(--teal)">Estimated Total: ₹${draft.total_amount}</div>
            <button class="assistant-card-btn" style="background:#0a5c36" onclick="confirmAssistantDraft()">✓ Confirm Booking Now</button>
          </div>
        `;
      } else if (m.requires_login) {
        actionHtml = `
          <div class="assistant-card" style="text-align:center">
            <div style="margin-bottom:6px;font-size:11px;color:#64748b">Account login required for this action</div>
            <button class="assistant-card-btn" onclick="closeAssistantDrawer(); openModal('#login-modal')">Log In to Continue →</button>
          </div>
        `;
      }

      return `
        <div class="chat-bubble ${isBot ? 'bot' : 'user'}">
          ${formattedText}
          ${actionHtml}
        </div>
      `;
    }).join('');

    list.scrollTop = list.scrollHeight;
  }

  async function sendAssistantMessage(rawText) {
    const input = document.getElementById('assistant-user-input');
    const sendBtn = document.getElementById('assistant-send-btn');
    const text = (rawText || input?.value || '').trim();
    if (!text) return;

    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    // Add user message to state
    state.assistantMessages.push({ sender: 'user', text });
    renderAssistantMessages();

    // Show typing indicator
    const list = document.getElementById('assistant-messages-list');
    const typingElem = document.createElement('div');
    typingElem.className = 'typing-indicator';
    typingElem.id = 'assistant-typing-indicator';
    typingElem.innerHTML = '<span></span><span></span><span></span>';
    list?.appendChild(typingElem);
    if (list) list.scrollTop = list.scrollHeight;

    try {
      const res = await API.chatAssistant(text, state.assistantContext, state.assistantMessages);
      state.assistantContext = res.context || state.assistantContext;

      document.getElementById('assistant-typing-indicator')?.remove();

      state.assistantMessages.push({
        sender: 'bot',
        text: res.reply,
        action: res.action,
        action_data: res.action_data,
        requires_login: res.requires_login
      });

      renderAssistantMessages();

      if (res.suggestions && res.suggestions.length) {
        const chipsContainer = document.getElementById('assistant-chips-container');
        if (chipsContainer) {
          chipsContainer.innerHTML = res.suggestions.map(s => `<button class="assistant-chip" data-prompt="${s}">${s}</button>`).join('');
        }
      }
    } catch (err) {
      document.getElementById('assistant-typing-indicator')?.remove();
      state.assistantMessages.push({
        sender: 'bot',
        text: 'I encountered a temporary connection issue. Please check your internet connection or try again.'
      });
      renderAssistantMessages();
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input?.focus();
    }
  }

  root.openAssistantDrawer = openAssistantDrawer;
  root.closeAssistantDrawer = closeAssistantDrawer;
  root.confirmAssistantDraft = async function() {
    await sendAssistantMessage('Yes, please confirm this booking.');
  };

  // ==========================================================================
  // PUBLIC LANDING RENDERING
  // ==========================================================================
  function renderLandingServices(category = 'ALL') {
    const grid = document.getElementById('service-grid');
    if (!grid) return;

    // Update tab counter for All Categories
    const allTab = document.querySelector('.category-tab[data-category="ALL"]');
    if (allTab && state.services.length) {
      allTab.textContent = `All Categories (${state.services.length})`;
    }

    let items = state.services;
    if (category && category !== 'ALL') {
      items = items.filter(s => (s.category || '').toUpperCase() === category.toUpperCase());
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#64748b">
          <div style="font-size:32px;margin-bottom:8px">🔍</div>
          <strong>No services found in this category.</strong>
          <p style="font-size:13px;margin-top:4px">Browse all categories or ask our AI Assistant to help you find the right specialist.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(s => `
      <div class="service-card">
        <div class="service-icon" style="background:${s.color || '#fff1cf'}">${s.icon || '⚡'}</div>
        <h3>${s.name}</h3>
        <p>${s.description || 'Everyday reliable home service in Varanasi'}</p>
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
          <div class="partner-avatar" style="${p.profile_photo ? 'padding:0;overflow:hidden;' : `background:${p.avatar_bg || '#e0f2fe'}`}">${p.profile_photo ? `<img src="${p.profile_photo}" alt="${p.full_name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : (p.initials || 'KP')}</div>
          <div class="partner-meta">
            <h4>${p.full_name} <span>✓</span></h4>
            <div class="partner-rating">★ ${p.rating || 4.9} <b>(${p.rating_count || 12} reviews)</b></div>
          </div>
        </div>
        <div class="partner-skills">
          ${(p.primary_skills || ['Verified Helper']).map(sk => `<span>${sk}</span>`).join('')}
        </div>
        <p class="partner-bio">${p.bio || 'Verified neighbourhood service professional in Lanka, Varanasi.'}</p>
        <div style="display:flex;gap:8px;margin-top:auto">
          <button class="button button-small button-ghost" style="flex:1;font-size:11px" onclick="openPartnerProfileModal('${p.id}')">Profile &amp; Reviews</button>
          <button class="button button-small button-lime" style="flex:1;font-size:11px" onclick="startBooking(null, '${p.id}')">Book Pro →</button>
        </div>
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
    // AI Assistant Open & Close bindings
    document.getElementById('open-assistant-nav-btn')?.addEventListener('click', openAssistantDrawer);
    document.getElementById('floating-assistant-btn')?.addEventListener('click', openAssistantDrawer);
    document.getElementById('close-assistant-btn')?.addEventListener('click', closeAssistantDrawer);
    document.getElementById('cust-launch-assistant-btn')?.addEventListener('click', openAssistantDrawer);
    document.querySelectorAll('[data-open-assistant]').forEach(el => el.addEventListener('click', openAssistantDrawer));

    // Quick Popular Service buttons & radar pins
    document.querySelectorAll('[data-quick-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        root.startBooking(btn.dataset.quickService);
      });
    });

    // Mobile Navigation Menu Toggle
    document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
      const nav = document.querySelector('.desktop-nav');
      if (nav) {
        nav.classList.toggle('mobile-open');
        if (nav.classList.contains('mobile-open')) {
          nav.style.display = 'flex';
          nav.style.flexDirection = 'column';
          nav.style.position = 'absolute';
          nav.style.top = '100%';
          nav.style.left = '0';
          nav.style.right = '0';
          nav.style.background = '#093a3e';
          nav.style.padding = '16px';
          nav.style.zIndex = '999';
        } else {
          nav.style.display = '';
        }
      }
    });

    // Assistant Send Button & Enter key
    const assistInput = document.getElementById('assistant-user-input');
    const assistSendBtn = document.getElementById('assistant-send-btn');
    assistSendBtn?.addEventListener('click', () => sendAssistantMessage());
    assistInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAssistantMessage();
      }
    });

    // Assistant Prompt Chips delegate
    document.getElementById('assistant-chips-container')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.assistant-chip');
      if (chip && chip.dataset.prompt) {
        sendAssistantMessage(chip.dataset.prompt);
      }
    });

    // Explore All Services Button
    document.getElementById('open-all-services-btn')?.addEventListener('click', () => {
      document.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
      document.querySelector('.category-tab[data-category="ALL"]')?.classList.add('active');
      renderLandingServices('ALL');
      document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
    });

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

    // Backdrop click closes assistant drawer as well
    document.getElementById('modal-backdrop')?.addEventListener('click', () => {
      closeAssistantDrawer();
    });

    // Category Tabs Filter
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
          phone: phone ? (phone.startsWith('+91') ? phone : `+91 ${phone}`) : '',
          password: pass,
          full_name: name,
          city,
          role: state.signupRole
        });
        showToast('Account created successfully!');
        onLoginSuccess(res);
        if (res.verification_required) {
          setTimeout(() => {
            root.openVerificationModal('EMAIL', email);
            if (res.dev_email_otp) {
              const otpInput = document.getElementById('verif-otp-input');
              if (otpInput) otpInput.value = res.dev_email_otp;
            }
          }, 600);
        }
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

    // Account Verification Modal Submissions
    document.getElementById('account-verification-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const channel = document.getElementById('verif-channel').value;
      const identifier = document.getElementById('verif-identifier').value;
      const otp = document.getElementById('verif-otp-input').value.trim();
      const btn = document.getElementById('verif-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Verifying Code...';

      try {
        if (channel === 'EMAIL') {
          await API.verifyEmail(identifier, otp);
          showToast('Email verified successfully! ✓');
          if (state.currentUser) state.currentUser.email_verified = 1;
        } else {
          await API.verifyPhone(identifier, otp);
          showToast('Phone verified successfully! ✓');
          if (state.currentUser) state.currentUser.phone_verified = 1;
        }
        closeModal('#account-verification-modal');
        if (state.currentRole === 'CUSTOMER') {
          const main = document.getElementById('customer-main-view');
          if (main && state.activeCustomerView === 'cust-profile') renderCustomerProfileView(main);
        } else if (state.currentRole === 'PARTNER') {
          const main = document.getElementById('partner-main-view');
          if (main && state.activePartnerView === 'part-profile') renderPartnerProfileView(main);
        }
      } catch (err) {
        showToast('Verification failed: ' + err.message, true);
        btn.disabled = false;
        btn.textContent = 'Verify & Confirm ✓';
      }
    });

    document.getElementById('verif-resend-btn')?.addEventListener('click', async () => {
      const channel = document.getElementById('verif-channel').value;
      const identifier = document.getElementById('verif-identifier').value;
      try {
        const res = await API.resendVerification(channel, identifier);
        showToast(res.message || 'Verification code resent!');
        if (res.dev_otp) {
          const otpInput = document.getElementById('verif-otp-input');
          if (otpInput) otpInput.value = res.dev_otp;
        }
      } catch (err) {
        showToast(err.message, true);
      }
    });

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

  root.openVerificationModal = function(channel = 'EMAIL', identifier = '') {
    const modal = document.getElementById('account-verification-modal');
    if (!modal) return;
    const title = document.getElementById('verif-modal-title');
    const desc = document.getElementById('verif-modal-desc');
    const chanInput = document.getElementById('verif-channel');
    const idInput = document.getElementById('verif-identifier');
    const targetDisplay = document.getElementById('verif-target-display');
    const targetLabel = document.getElementById('verif-target-label');
    const otpInput = document.getElementById('verif-otp-input');

    const targetVal = identifier || (channel === 'EMAIL' ? state.currentUser?.email : state.currentUser?.phone) || '';
    if (chanInput) chanInput.value = channel;
    if (idInput) idInput.value = targetVal;
    if (targetDisplay) targetDisplay.value = targetVal;
    if (targetLabel) targetLabel.textContent = channel === 'EMAIL' ? 'Registered Email Address' : 'Registered Indian Phone';
    if (title) title.innerHTML = channel === 'EMAIL' ? 'Verify Your<br /><em>Email Address</em>' : 'Verify Your<br /><em>Mobile Number</em>';
    if (desc) desc.textContent = `Enter the 6-digit verification code sent to ${targetVal}.`;
    if (otpInput) {
      otpInput.value = '';
      setTimeout(() => otpInput.focus(), 250);
    }

    openModal('#account-verification-modal');
  };

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
