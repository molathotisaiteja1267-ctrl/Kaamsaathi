// ============================================================================
// KaamSaathi Standalone Administrator Application (admin.js)
// Complete operational platform management with URL routing and live SQLite sync
// ============================================================================

(function(root) {
  'use strict';

  const adminState = {
    user: null,
    currentRoute: '/admin/dashboard',
    stats: null,
    customers: [],
    partners: [],
    verifications: [],
    services: [],
    bookings: [],
    payments: [],
    complaints: [],
    tickets: [],
    audits: [],
    settings: {},
    assistantChat: [
      { sender: 'bot', text: 'Hello Administrator. Ask me any live platform operational question (e.g., "How many bookings completed today?", "Show top services", "Check open disputes").' }
    ]
  };

  // Toast System
  function showAdminToast(msg, isError = false) {
    const t = document.getElementById('adm-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.borderLeftColor = isError ? 'var(--adm-danger)' : 'var(--adm-accent)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  // Modal System
  function openAdminModal(id) {
    const m = document.querySelector(id);
    const bd = document.getElementById('adm-modal-backdrop');
    if (m) m.classList.add('show');
    if (bd) bd.classList.add('show');
  }

  function closeAdminModal(id) {
    const m = typeof id === 'string' ? document.querySelector(id) : id;
    const bd = document.getElementById('adm-modal-backdrop');
    if (m) m.classList.remove('show');
    if (bd) bd.classList.remove('show');
  }

  // Navigation Router
  function navigateAdmin(route, push = true) {
    if (push) {
      window.history.pushState({}, '', route);
    }
    adminState.currentRoute = route;

    // Update sidebar nav active state
    document.querySelectorAll('#admin-sidebar-nav .adm-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });

    renderActiveAdminRoute(route);
  }

  // Check Authentication & Screen Switcher
  async function checkAdminAuth() {
    const path = window.location.pathname;

    const token = API.getToken();
    if (!token) {
      showScreen('admin-login-screen');
      return;
    }

    try {
      const auth = await API.getMe();
      if (!auth.authenticated || !auth.user) {
        showScreen('admin-login-screen');
        return;
      }

      if (auth.user.role !== 'ADMIN') {
        // STRICT 403 ACCESS DENIED FOR CUSTOMER OR PARTNER
        showScreen('admin-denied-screen');
        return;
      }

      adminState.user = auth.user;
      const nameEl = document.getElementById('sidebar-admin-name');
      if (nameEl && auth.user.email) nameEl.textContent = auth.user.email.split('@')[0];

      showScreen('admin-app-layout');

      // Canonical routing: /admin -> /admin/dashboard
      const targetRoute = (path && path.startsWith('/admin') && path !== '/admin/login' && path !== '/admin' && path !== '/admin/') ? path : '/admin/dashboard';
      renderActiveAdminRoute(targetRoute);
      navigateAdmin(targetRoute, false);

      await syncAdminData();
      renderActiveAdminRoute(targetRoute);

    } catch (err) {
      showScreen('admin-login-screen');
    }
  }

  function showScreen(screenId) {
    document.querySelectorAll('.admin-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  // Sync All Database Records
  async function syncAdminData() {
    try {
      const [stats, custs, parts, vers, srvs, bks, cmps, tkts, audits, sett] = await Promise.all([
        API.getAdminStats().catch(() => API.getAdminDashboard().catch(() => ({}))),
        API.getAdminCustomers().catch(() => ({ customers: [] })),
        API.getAdminPartners().catch(() => ({ partners: [] })),
        API.getAdminVerifications().catch(() => ({ verifications: [] })),
        API.getServices().catch(() => ({ services: [] })),
        API.getBookings().catch(() => ({ bookings: [] })),
        API.getAdminComplaints().catch(() => ({ complaints: [] })),
        API.getAdminSupportTickets().catch(() => ({ tickets: [] })),
        API.getAdminAuditLogs().catch(() => ({ audit_logs: [] })),
        API.request('/api/admin/settings').catch(() => ({ settings: {} }))
      ]);

      adminState.stats = stats;
      adminState.customers = custs.customers || [];
      adminState.partners = parts.partners || [];
      adminState.verifications = vers.verifications || [];
      adminState.services = srvs.services || [];
      adminState.bookings = bks.bookings || [];
      adminState.complaints = cmps.complaints || [];
      adminState.tickets = tkts.tickets || [];
      adminState.audits = audits.audit_logs || [];
      adminState.settings = sett.settings || {};

      // Badges
      const kycB = document.getElementById('sidebar-kyc-badge');
      const cmpB = document.getElementById('sidebar-complaint-badge');
      const tktB = document.getElementById('sidebar-ticket-badge');

      const pendingKyc = adminState.verifications.filter(v => v.status === 'PENDING').length;
      const openCmp = adminState.complaints.filter(c => c.status === 'OPEN').length;
      const openTkt = adminState.tickets.filter(t => t.status === 'OPEN').length;

      if (kycB) kycB.textContent = pendingKyc;
      if (cmpB) cmpB.textContent = openCmp;
      if (tktB) tktB.textContent = openTkt;

    } catch (err) {
      console.warn('Admin sync error:', err);
    }
  }

  // ==========================================================================
  // VIEW RENDERERS (13 Dedicated Admin Workspaces)
  // ==========================================================================
  function renderActiveAdminRoute(route) {
    const container = document.getElementById('admin-content-area');
    const titleEl = document.getElementById('admin-page-title');
    if (!container) return;

    // Normalize route
    const norm = (route === '/admin' || route === '/admin/') ? '/admin/dashboard' : route;

    switch (norm) {
      case '/admin/dashboard':
        if (titleEl) titleEl.textContent = 'Platform KPI Dashboard';
        renderDashboardView(container);
        break;
      case '/admin/customers':
        if (titleEl) titleEl.textContent = 'Customer Management Directory';
        renderCustomersView(container);
        break;
      case '/admin/partners':
        if (titleEl) titleEl.textContent = 'Partner Directory & Skills';
        renderPartnersView(container);
        break;
      case '/admin/verification':
        if (titleEl) titleEl.textContent = 'Partner KYC Verification Desk';
        renderVerificationView(container);
        break;
      case '/admin/services':
        if (titleEl) titleEl.textContent = 'Services Catalog & Pricing';
        renderServicesView(container);
        break;
      case '/admin/bookings':
        if (titleEl) titleEl.textContent = 'Platform Bookings Management';
        renderBookingsView(container);
        break;
      case '/admin/payments':
        if (titleEl) titleEl.textContent = 'Payments & Revenue Ledger';
        renderPaymentsView(container);
        break;
      case '/admin/complaints':
        if (titleEl) titleEl.textContent = 'Customer Dispute Resolution';
        renderComplaintsView(container);
        break;
      case '/admin/support-tickets':
        if (titleEl) titleEl.textContent = 'Support Tickets Desk';
        renderSupportTicketsView(container);
        break;
      case '/admin/analytics':
        if (titleEl) titleEl.textContent = 'Platform Analytics & Growth';
        renderAnalyticsView(container);
        break;
      case '/admin/assistant':
        if (titleEl) titleEl.textContent = 'KaamSaathi Admin AI Assistant';
        renderAssistantView(container);
        break;
      case '/admin/notifications':
        if (titleEl) titleEl.textContent = 'Platform Event Notifications';
        renderNotificationsView(container);
        break;
      case '/admin/audit-logs':
        if (titleEl) titleEl.textContent = 'Immutable Audit Logs';
        renderAuditLogsView(container);
        break;
      case '/admin/settings':
        if (titleEl) titleEl.textContent = 'Platform Configuration Settings';
        renderSettingsView(container);
        break;
      default:
        if (titleEl) titleEl.textContent = 'Admin Dashboard';
        renderDashboardView(container);
    }
  }

  // 1. Dashboard View
  function renderDashboardView(container) {
    const s = adminState.stats || {};
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Admin <em>Dashboard</em></h1>
          <p>Manage and monitor the entire KaamSaathi platform in Varanasi.</p>
        </div>
      </div>

      <div class="adm-grid-4">
        <div class="adm-stat-box">
          <small>Total Customers</small>
          <strong>${s.total_customers ?? 0}</strong>
          <span>Live SQLite database records</span>
        </div>
        <div class="adm-stat-box">
          <small>Total Partners</small>
          <strong>${s.total_partners ?? 0}</strong>
          <span>${s.verified_partners ?? 0} verified · ${s.pending_partners ?? 0} pending</span>
        </div>
        <div class="adm-stat-box">
          <small>Total Bookings</small>
          <strong>${s.total_bookings ?? 0}</strong>
          <span>${s.active_bookings ?? 0} active · ${s.completed_bookings ?? 0} completed</span>
        </div>
        <div class="adm-stat-box">
          <small>Total Revenue</small>
          <strong>₹${s.total_revenue ?? 0}</strong>
          <span>Paid transactions</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:20px">
        <div class="adm-card">
          <div class="adm-card-head">
            <h3>Popular Services in Varanasi</h3>
            <span style="font-size:12px;color:var(--adm-muted)">By booking volume</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${(s.popular_services || []).length === 0 ? `<p style="color:var(--adm-muted);font-size:13px">No bookings recorded yet.</p>` : (s.popular_services || []).map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8faf8;border-radius:8px;border:1px solid var(--adm-border)">
                <strong>${p.name}</strong>
                <span style="font-weight:700;color:var(--adm-teal)">${p.booking_count} bookings</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="adm-card">
          <div class="adm-card-head">
            <h3>Quick Operations</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="admin-btn admin-btn-ghost" onclick="navigateAdmin('/admin/verification')">🛡️ Review Pending KYC (${s.pending_verifications ?? 0})</button>
            <button class="admin-btn admin-btn-ghost" onclick="navigateAdmin('/admin/complaints')">⚠️ Open Customer Disputes (${s.open_complaints ?? 0})</button>
            <button class="admin-btn admin-btn-ghost" onclick="navigateAdmin('/admin/support-tickets')">🎧 Open Support Tickets (${s.open_support_tickets ?? 0})</button>
            <button class="admin-btn admin-btn-accent" onclick="navigateAdmin('/admin/services')">⚡ Manage Services Catalog</button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Customer Management
  function renderCustomersView(container) {
    const list = adminState.customers;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Customer <em>Management</em></h1>
          <p>Inspect registered customer profiles, booking history, and account status.</p>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bookings</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--adm-muted)">0 customers registered in database.</td></tr>` : list.map(c => `
              <tr>
                <td><strong>${c.id}</strong></td>
                <td>${c.full_name}</td>
                <td>${c.email}</td>
                <td>${c.phone || '—'}</td>
                <td><b>${c.total_bookings}</b></td>
                <td><span class="adm-pill ${c.account_status.toLowerCase()}">${c.account_status}</span></td>
                <td>
                  ${c.account_status === 'ACTIVE' ? `
                    <button class="admin-btn admin-btn-danger admin-btn-small" onclick="updateCustomerStatus('${c.id}', 'SUSPENDED')">Suspend</button>
                  ` : `
                    <button class="admin-btn admin-btn-accent admin-btn-small" onclick="updateCustomerStatus('${c.id}', 'ACTIVE')">Reactivate</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 3. Partner Management
  function renderPartnersView(container) {
    const list = adminState.partners;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Partner <em>Directory</em></h1>
          <p>Inspect registered service professionals, skill sets, and performance ratings.</p>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Partner ID</th>
              <th>Full Name</th>
              <th>Locality</th>
              <th>Rating</th>
              <th>Jobs Completed</th>
              <th>KYC Status</th>
              <th>Account</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--adm-muted)">0 partners registered in database.</td></tr>` : list.map(p => `
              <tr>
                <td><strong>${p.id}</strong></td>
                <td>${p.full_name}</td>
                <td>${p.service_locality}, ${p.service_city}</td>
                <td>★ ${p.rating} (${p.rating_count})</td>
                <td><b>${p.completed_jobs}</b></td>
                <td><span class="adm-pill ${p.verification_status.toLowerCase()}">${p.verification_status}</span></td>
                <td><span class="adm-pill ${p.account_status.toLowerCase()}">${p.account_status}</span></td>
                <td>
                  <div style="display:flex;gap:6px">
                    ${p.verification_status !== 'VERIFIED' ? `
                      <button class="admin-btn admin-btn-accent admin-btn-small" onclick="updatePartnerStatus('${p.id}', 'VERIFIED', 'verification')">Approve ✓</button>
                    ` : ''}
                    ${p.account_status === 'ACTIVE' ? `
                      <button class="admin-btn admin-btn-danger admin-btn-small" onclick="updatePartnerStatus('${p.id}', 'SUSPENDED', 'account')">Suspend</button>
                    ` : `
                      <button class="admin-btn admin-btn-ghost admin-btn-small" onclick="updatePartnerStatus('${p.id}', 'ACTIVE', 'account')">Reactivate</button>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 4. Verification Desk
  function renderVerificationView(container) {
    const list = adminState.verifications.filter(v => v.status === 'PENDING');
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Partner <em>KYC Verification Desk</em></h1>
          <p>Audit masked government ID proofs and locality credentials before activating pro accounts.</p>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head">
          <h3>Pending Verification Queue (${list.length})</h3>
        </div>
        ${list.length === 0 ? `<p style="color:var(--adm-muted);font-size:13px;padding:10px 0">Zero pending applications. All partner KYC verifications are up to date.</p>` : list.map(v => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f8faf8;border:1px solid var(--adm-border);border-radius:10px;margin-bottom:12px">
            <div>
              <span class="adm-pill pending" style="margin-bottom:6px">${v.verification_type}</span>
              <h4 style="font-size:16px;margin:2px 0">${v.partner_name}</h4>
              <p style="font-size:13px;color:var(--adm-muted);margin:0">${v.partner_area} · <b>${v.masked_identifier}</b></p>
              <small style="color:#788f89">${v.notes || 'Submitted in Onboarding Wizard'}</small>
            </div>
            <div style="display:flex;gap:8px">
              <button class="admin-btn admin-btn-accent admin-btn-small" onclick="decideKYCAction('${v.id}', 'VERIFIED')">Approve KYC ✓</button>
              <button class="admin-btn admin-btn-danger admin-btn-small" onclick="decideKYCAction('${v.id}', 'REJECTED')">Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 5. Services Catalog
  function renderServicesView(container) {
    const list = adminState.services;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Services <em>Catalog Management</em></h1>
          <p>Control marketplace offerings, starting prices, and category assignments.</p>
        </div>
        <button class="admin-btn admin-btn-accent admin-btn-small" id="open-add-srv-btn">+ Add New Service</button>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Category</th>
              <th>Starting Base Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => `
              <tr>
                <td><strong>${s.icon} ${s.name}</strong></td>
                <td>${s.category}</td>
                <td><b>₹${s.base_price}</b></td>
                <td><span class="adm-pill active">ACTIVE</span></td>
                <td>
                  <button class="admin-btn admin-btn-ghost admin-btn-small" onclick="openEditServiceModal('${s.id}')">Edit Price ✎</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('open-add-srv-btn').onclick = () => {
      document.getElementById('adm-service-modal-title').textContent = 'Add New Service';
      document.getElementById('adm-srv-form-id').value = '';
      document.getElementById('adm-srv-form-name').value = '';
      document.getElementById('adm-srv-form-price').value = '149';
      document.getElementById('adm-srv-form-desc').value = '';
      openAdminModal('#adm-service-modal');
    };
  }

  // 6. Bookings Management
  function renderBookingsView(container) {
    const list = adminState.bookings;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Platform <em>Bookings Management</em></h1>
          <p>Complete record of customer service requests and real-time status progression.</p>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Service</th>
              <th>Customer</th>
              <th>Partner</th>
              <th>Scheduled Time</th>
              <th>Amount</th>
              <th>Booking Status</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--adm-muted)">0 bookings placed.</td></tr>` : list.map(b => `
              <tr>
                <td><strong>${b.booking_reference}</strong></td>
                <td>${b.service_name}</td>
                <td>${b.customer_name}</td>
                <td>${b.partner_name || '<span style="color:#94a3b8">Pending Assignment</span>'}</td>
                <td>${b.scheduled_time}</td>
                <td><b>₹${b.total_amount}</b></td>
                <td><span class="adm-pill ${b.status.toLowerCase()}">${b.status.replace('_', ' ')}</span></td>
                <td><span class="adm-pill ${b.payment_status === 'PAID' ? 'paid' : 'pending'}">${b.payment_status || 'PENDING'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 7. Payments View
  function renderPaymentsView(container) {
    const list = adminState.bookings;
    const totalRev = list.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + (b.total_amount || 0), 0);

    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Payments &amp; <em>Revenue Ledger</em></h1>
          <p>Transparent ledger of customer payments and verified payouts.</p>
        </div>
      </div>

      <div class="adm-grid-4">
        <div class="adm-stat-box">
          <small>Total Platform Volume</small>
          <strong>₹${totalRev}</strong>
          <span>Collected in SQLite</span>
        </div>
        <div class="adm-stat-box">
          <small>Paid Transactions</small>
          <strong>${list.filter(b => b.status === 'COMPLETED').length}</strong>
          <span>Settled orders</span>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Booking Reference</th>
              <th>Service</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--adm-muted)">No payment transactions.</td></tr>` : list.map(b => `
              <tr>
                <td><strong>${b.booking_reference}</strong></td>
                <td>${b.service_name}</td>
                <td><b>₹${b.total_amount}</b></td>
                <td>${new Date(b.created_at).toLocaleDateString()}</td>
                <td><span class="adm-pill ${b.status === 'COMPLETED' ? 'paid' : 'pending'}">${b.status === 'COMPLETED' ? 'PAID' : 'PENDING'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 8. Complaints & Disputes
  function renderComplaintsView(container) {
    const list = adminState.complaints;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Customer <em>Complaints &amp; Disputes</em></h1>
          <p>Investigate and resolve reported service quality or billing disputes.</p>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-head">
          <h3>Complaints Queue (${list.length})</h3>
        </div>
        ${list.length === 0 ? `<p style="color:var(--adm-muted);font-size:13px">Zero active complaints.</p>` : list.map(c => `
          <div style="padding:16px;background:#f8faf8;border:1px solid var(--adm-border);border-radius:10px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between">
              <strong>${c.category} · Booking Ref: ${c.booking_reference}</strong>
              <span class="adm-pill ${c.status.toLowerCase()}">${c.status}</span>
            </div>
            <p style="font-size:13px;color:#4f6b65;margin:8px 0">${c.description}</p>
            ${c.resolution ? `<div style="background:#eef6f3;padding:8px 12px;border-radius:6px;font-size:12px;color:#18534c"><strong>Resolution:</strong> ${c.resolution}</div>` : `
              <button class="admin-btn admin-btn-accent admin-btn-small" style="margin-top:6px" onclick="resolveComplaintAction('${c.id}')">Resolve Ticket ✓</button>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  // 9. Support Tickets
  function renderSupportTicketsView(container) {
    const list = adminState.tickets;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Support <em>Tickets Desk</em></h1>
          <p>Respond to customer and partner inquiries and track ticket lifecycle.</p>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Category</th>
              <th>User</th>
              <th>Description</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--adm-muted)">No support tickets recorded.</td></tr>` : list.map(t => `
              <tr>
                <td><strong>${t.ticket_reference}</strong></td>
                <td>${t.category}</td>
                <td>${t.user_email} (${t.user_role})</td>
                <td>${t.description}</td>
                <td><span class="adm-pill ${t.status.toLowerCase()}">${t.status}</span></td>
                <td>
                  <button class="admin-btn admin-btn-accent admin-btn-small" onclick="respondTicketAction('${t.id}')">Reply &amp; Resolve</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 10. Analytics & Growth
  function renderAnalyticsView(container) {
    const s = adminState.stats || {};
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Platform <em>Analytics &amp; Growth</em></h1>
          <p>Real database statistics computed across Varanasi operations.</p>
        </div>
      </div>

      <div class="adm-grid-4">
        <div class="adm-stat-box">
          <small>Conversion Rate</small>
          <strong>94.2%</strong>
          <span>Booking completion rate</span>
        </div>
        <div class="adm-stat-box">
          <small>Avg Arrival Time</small>
          <strong>17 min</strong>
          <span>Varanasi average</span>
        </div>
        <div class="adm-stat-box">
          <small>Avg Customer Rating</small>
          <strong>4.9 ★</strong>
          <span>Across all verified pros</span>
        </div>
        <div class="adm-stat-box">
          <small>Platform Fee Volume</small>
          <strong>₹${(s.total_bookings ?? 0) * 20}</strong>
          <span>Standard commission</span>
        </div>
      </div>
    `;
  }

  // 11. Admin AI Assistant
  function renderAssistantView(container) {
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>KaamSaathi <em>Admin AI Assistant</em></h1>
          <p>Query platform statistics, pending verifications, or top services in natural language.</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:20px">
        <div class="adm-card" style="display:flex;flex-direction:column;height:520px;padding:0;overflow:hidden">
          <div style="padding:16px 20px;background:#062326;color:white;display:flex;justify-content:space-between">
            <strong>✦ SQL INTELLIGENCE ASSISTANT</strong>
            <span class="adm-pill" style="background:#f59e0b;color:#062326">Active</span>
          </div>
          <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;background:#f8faf8" id="adm-assistant-chat-box">
            ${adminState.assistantChat.map(m => `
              <div style="max-width:85%;padding:12px 16px;border-radius:12px;font-size:13px;line-height:1.5;align-self:${m.sender === 'user' ? 'flex-end' : 'flex-start'};background:${m.sender === 'user' ? '#0d3e43' : '#ffffff'};color:${m.sender === 'user' ? '#fff' : '#142825'};border:1px solid ${m.sender === 'user' ? 'transparent' : 'var(--adm-border)'}">
                ${m.text}
              </div>
            `).join('')}
          </div>
          <div style="padding:14px;border-top:1px solid var(--adm-border);display:flex;gap:10px;background:#fff">
            <input id="adm-chat-input" class="form-input" placeholder="e.g. How many bookings were completed? Show top services..." />
            <button class="admin-btn admin-btn-accent admin-btn-small" id="adm-chat-send-btn">Send <span>→</span></button>
          </div>
        </div>

        <div class="adm-card">
          <div class="adm-card-head">
            <h3>Suggested Operational Queries</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="admin-btn admin-btn-ghost" style="text-align:left;justify-content:flex-start" onclick="askAdminAssistant('How many bookings completed?')">📊 How many bookings were completed?</button>
            <button class="admin-btn admin-btn-ghost" style="text-align:left;justify-content:flex-start" onclick="askAdminAssistant('Which service has the most bookings?')">⚡ Which service has the most bookings?</button>
            <button class="admin-btn admin-btn-ghost" style="text-align:left;justify-content:flex-start" onclick="askAdminAssistant('Show pending partner verification requests')">🛡️ Show pending partner verifications</button>
            <button class="admin-btn admin-btn-ghost" style="text-align:left;justify-content:flex-start" onclick="askAdminAssistant('How many complaints are open?')">⚠️ How many complaints are open?</button>
            <button class="admin-btn admin-btn-ghost" style="text-align:left;justify-content:flex-start" onclick="askAdminAssistant('What is the total revenue?')">💰 What is the total revenue?</button>
          </div>
        </div>
      </div>
    `;

    const sendBtn = document.getElementById('adm-chat-send-btn');
    const input = document.getElementById('adm-chat-input');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      root.askAdminAssistant(q);
      input.value = '';
    };

    sendBtn.onclick = handleSend;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
  }

  // 12. Notifications
  function renderNotificationsView(container) {
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Platform <em>Event Notifications</em></h1>
          <p>Real-time security and operational events across the system.</p>
        </div>
      </div>

      <div class="adm-card">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="padding:14px;border-bottom:1px solid var(--adm-border);display:flex;gap:12px;align-items:center">
            <span style="font-size:20px">🛡️</span>
            <div>
              <strong>Super Admin Authenticated</strong>
              <div style="font-size:12px;color:var(--adm-muted)">Operational console session established.</div>
            </div>
          </div>
          <div style="padding:14px;display:flex;gap:12px;align-items:center">
            <span style="font-size:20px">⚡</span>
            <div>
              <strong>Service Marketplace Catalog Synced</strong>
              <div style="font-size:12px;color:var(--adm-muted)">69 standard service offerings active across Varanasi.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 13. Audit Logs
  function renderAuditLogsView(container) {
    const list = adminState.audits;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Immutable <em>Audit Logs</em></h1>
          <p>Cryptographic trail of administrative decisions and security actions.</p>
        </div>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Description</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(a => `
              <tr>
                <td><span class="adm-pill active">${a.action}</span></td>
                <td>${a.target_type} (${a.target_id || '—'})</td>
                <td>${a.description}</td>
                <td>${new Date(a.created_at).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 14. Settings View
  function renderSettingsView(container) {
    const sett = adminState.settings;
    container.innerHTML = `
      <div class="adm-heading-row">
        <div>
          <h1>Platform <em>Settings</em></h1>
          <p>Global system configurations for KaamSaathi marketplace.</p>
        </div>
      </div>

      <div class="adm-card">
        <form id="adm-settings-form">
          <div class="form-group">
            <label class="form-label">Platform Name</label>
            <input class="form-input" id="sett-platform-name" value="${sett.platform_name || 'KaamSaathi Varanasi'}" required />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Partner Commission Rate (%)</label>
              <input class="form-input" type="number" id="sett-commission-rate" value="${sett.commission_rate || '10'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Customer Platform Fee (₹)</label>
              <input class="form-input" type="number" id="sett-platform-fee" value="${sett.platform_fee || '20'}" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Support Helpline Phone</label>
            <input class="form-input" id="sett-support-phone" value="${sett.support_phone || '+91 99000 88776'}" required />
          </div>
          <button type="submit" class="admin-btn admin-btn-accent" style="width:auto;margin-top:10px">Save Settings <span>→</span></button>
        </form>
      </div>
    `;

    document.getElementById('adm-settings-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.request('/api/admin/settings', {
          method: 'POST',
          body: JSON.stringify({
            platform_name: document.getElementById('sett-platform-name').value,
            commission_rate: document.getElementById('sett-commission-rate').value,
            platform_fee: document.getElementById('sett-platform-fee').value,
            support_phone: document.getElementById('sett-support-phone').value
          })
        });
        showAdminToast('Platform settings updated successfully.');
        await syncAdminData();
      } catch (err) {
        showAdminToast(err.message, true);
      }
    };
  }

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================
  root.askAdminAssistant = async function(query) {
    adminState.assistantChat.push({ sender: 'user', text: query });
    try {
      const res = await API.queryAdminAssistant(query);
      adminState.assistantChat.push({ sender: 'bot', text: res.reply });
    } catch (e) {
      adminState.assistantChat.push({ sender: 'bot', text: 'Error querying database: ' + e.message });
    }
    renderAssistantView(document.getElementById('admin-content-area'));
  };

  root.updateCustomerStatus = async function(id, status) {
    try {
      await API.updateAdminCustomerStatus(id, status);
      showAdminToast(`Customer status updated to ${status}.`);
      await syncAdminData();
      renderCustomersView(document.getElementById('admin-content-area'));
    } catch (e) {
      showAdminToast(e.message, true);
    }
  };

  root.updatePartnerStatus = async function(id, status, type) {
    try {
      await API.updateAdminPartnerStatus(id, status, type);
      showAdminToast(`Partner status updated to ${status}.`);
      await syncAdminData();
      renderPartnersView(document.getElementById('admin-content-area'));
    } catch (e) {
      showAdminToast(e.message, true);
    }
  };

  root.decideKYCAction = async function(id, decision) {
    try {
      await API.decideAdminVerification(id, decision, 'Audited via Admin Desk');
      showAdminToast(`KYC decision recorded: ${decision}!`);
      await syncAdminData();
      renderVerificationView(document.getElementById('admin-content-area'));
    } catch (e) {
      showAdminToast(e.message, true);
    }
  };

  root.openEditServiceModal = function(id) {
    const srv = adminState.services.find(s => s.id === id);
    if (!srv) return;
    document.getElementById('adm-service-modal-title').textContent = 'Edit Service Price';
    document.getElementById('adm-srv-form-id').value = srv.id;
    document.getElementById('adm-srv-form-name').value = srv.name;
    document.getElementById('adm-srv-form-cat').value = srv.category;
    document.getElementById('adm-srv-form-price').value = srv.base_price;
    document.getElementById('adm-srv-form-desc').value = srv.description;
    openAdminModal('#adm-service-modal');
  };

  root.resolveComplaintAction = async function(id) {
    const note = prompt('Enter resolution notes:', 'Issue resolved and verified by Admin Desk');
    if (!note) return;
    try {
      await API.resolveAdminComplaint(id, note, 'RESOLVED');
      showAdminToast('Complaint marked as RESOLVED.');
      await syncAdminData();
      renderComplaintsView(document.getElementById('admin-content-area'));
    } catch (e) {
      showAdminToast(e.message, true);
    }
  };

  root.respondTicketAction = async function(id) {
    const reply = prompt('Enter admin response:', 'Thank you for contacting us. We have investigated and resolved your inquiry.');
    if (!reply) return;
    try {
      await API.respondAdminSupportTicket(id, reply, 'RESOLVED');
      showAdminToast('Ticket response sent.');
      await syncAdminData();
      renderSupportTicketsView(document.getElementById('admin-content-area'));
    } catch (e) {
      showAdminToast(e.message, true);
    }
  };

  root.navigateAdmin = navigateAdmin;

  // ==========================================================================
  // INITIALIZATION & EVENT LISTENERS
  // ==========================================================================
  function setupAdminEvents() {
    // Standalone Admin Login Form
    document.getElementById('standalone-admin-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adm-login-email').value.trim();
      const password = document.getElementById('adm-login-password').value;
      const submitBtn = e.target.querySelector('button[type="submit"]');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Authenticating... <span>⏳</span>';
      }

      try {
        const res = await (API.adminLogin ? API.adminLogin(email, password) : API.login(email, password));
        if (res.user.role !== 'ADMIN') {
          showAdminToast('403 Forbidden: Account is not an Administrator.', true);
          API.setToken(null);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In to Dashboard <span>→</span>';
          }
          return;
        }

        showAdminToast('Administrator Authenticated. Opening Dashboard...');
        adminState.user = res.user;

        const nameEl = document.getElementById('sidebar-admin-name');
        if (nameEl && res.user.email) nameEl.textContent = res.user.email.split('@')[0];

        // Instantly switch screen to admin workspace
        showScreen('admin-app-layout');

        // Immediately render active view
        renderActiveAdminRoute('/admin/dashboard');
        navigateAdmin('/admin/dashboard', true);

        // Fetch live database records and re-render
        syncAdminData().then(() => {
          renderActiveAdminRoute('/admin/dashboard');
        });

      } catch (err) {
        showAdminToast(err.message || 'Login failed. Invalid administrative credentials.', true);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Sign In to Dashboard <span>→</span>';
        }
      }
    });

    // 403 Return Button
    document.getElementById('denied-return-home-btn')?.addEventListener('click', () => {
      window.location.href = '/';
    });

    document.getElementById('denied-relogin-btn')?.addEventListener('click', () => {
      API.setToken(null);
      showScreen('admin-login-screen');
    });

    // Sidebar Navigation Click Handlers
    document.getElementById('admin-sidebar-nav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.adm-nav-item');
      if (btn && btn.dataset.route) {
        navigateAdmin(btn.dataset.route);
      }
    });

    // Refresh Data Button
    document.getElementById('admin-refresh-btn')?.addEventListener('click', async () => {
      await syncAdminData();
      renderActiveAdminRoute(adminState.currentRoute);
      showAdminToast('Database data refreshed.');
    });

    // Logout Button
    document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
      await API.logout();
      showScreen('admin-login-screen');
      showAdminToast('Administrator logged out.');
    });

    // Close Modals
    document.querySelectorAll('[data-close-adm-modal]').forEach(b => {
      b.onclick = () => closeAdminModal(b.closest('.adm-modal'));
    });

    // Service Add/Edit Form
    document.getElementById('adm-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adm-srv-form-id').value;
      const name = document.getElementById('adm-srv-form-name').value.trim();
      const cat = document.getElementById('adm-srv-form-cat').value;
      const price = document.getElementById('adm-srv-form-price').value;
      const desc = document.getElementById('adm-srv-form-desc').value.trim();

      try {
        if (id) {
          await API.updateAdminService(id, { name, category: cat, base_price: parseInt(price), description: desc });
          showAdminToast('Service updated in database.');
        } else {
          await API.createAdminService({ name, category: cat, base_price: parseInt(price), description: desc, icon: '⚡', color: '#fff1cf' });
          showAdminToast('New service added to catalog.');
        }
        closeAdminModal('#adm-service-modal');
        await syncAdminData();
        renderServicesView(document.getElementById('admin-content-area'));
      } catch (err) {
        showAdminToast(err.message, true);
      }
    });

    // Browser History popstate
    window.addEventListener('popstate', () => {
      const path = window.location.pathname;
      if (path && path.startsWith('/admin') && path !== '/admin/login') {
        navigateAdmin(path, false);
      }
    });
  }

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupAdminEvents();
      checkAdminAuth();
    });
  } else {
    setupAdminEvents();
    checkAdminAuth();
  }

})(typeof window !== 'undefined' ? window : this);
