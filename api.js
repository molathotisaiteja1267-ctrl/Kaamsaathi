// ============================================================================
// KaamSaathi Frontend API Client (api.js)
// Real REST HTTP communication with the Flask & SQLite Backend Server
// ============================================================================

(function(root) {
  'use strict';

  const TOKEN_KEY = 'KAAMSAATHI_AUTH_TOKEN';
  function getBaseUrl() {
    if (typeof window !== 'undefined') {
      if (window.__API_BASE_URL__) return window.__API_BASE_URL__;
      if (window.API_BASE_URL) return window.API_BASE_URL;
      const stored = localStorage.getItem('API_BASE_URL');
      if (stored) return stored;
      if (window.location && window.location.protocol === 'file:') {
        return 'http://localhost:8080';
      }
    }
    return '';
  }
  const BASE_URL = getBaseUrl();

  class KaamSaathiAPI {
    constructor() {
      this.token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
    }

    setToken(token, persist = true) {
      this.token = token;
      if (token) {
        if (persist) {
          localStorage.setItem(TOKEN_KEY, token);
        } else {
          sessionStorage.setItem(TOKEN_KEY, token);
        }
      } else {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }

    getToken() {
      return this.token || localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    }

    async request(endpoint, options = {}) {
      const url = `${BASE_URL}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, {
          ...options,
          credentials: 'include',
          headers
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401 && endpoint !== '/api/auth/login' && endpoint !== '/api/admin/login' && endpoint !== '/api/auth/me') {
            this.setToken(null);
            window.dispatchEvent(new CustomEvent('ks:auth_unauthorized'));
          }
          throw new Error(data.error || `HTTP ${response.status}: Request failed`);
        }

        return data;
      } catch (err) {
        console.error(`API Error on ${endpoint}:`, err);
        throw err;
      }
    }

    // --- Authentication & Profile ---
    async login(email, password) {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    }

    async register(userData) {
      const data = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    }

    async verifyEmail(email, otp) {
      return await this.request('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });
    }

    async verifyPhone(phone, otp) {
      return await this.request('/api/auth/verify-phone', {
        method: 'POST',
        body: JSON.stringify({ phone, otp })
      });
    }

    async resendVerification(channel, identifier) {
      return await this.request('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ channel, identifier })
      });
    }

    async getMe() {
      return await this.request('/api/auth/me');
    }

    async updateProfile(profileData) {
      return await this.request('/api/auth/profile', {
        method: 'POST',
        body: JSON.stringify(profileData)
      });
    }

    async changePassword(currentPassword, newPassword) {
      return await this.request('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
    }

    async deleteAccount(password) {
      const data = await this.request('/api/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      this.setToken(null);
      return data;
    }

    async logout() {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } finally {
        this.setToken(null);
      }
    }

    // --- Services ---
    async getServices(category = '', search = '') {
      let query = [];
      if (category && category !== 'ALL') query.push(`category=${encodeURIComponent(category)}`);
      if (search) query.push(`search=${encodeURIComponent(search)}`);
      const qs = query.length ? `?${query.join('&')}` : '';
      return await this.request(`/api/services${qs}`);
    }

    // --- Partners ---
    async getPartners(serviceName = '', locality = '') {
      let query = [];
      if (serviceName) query.push(`service_name=${encodeURIComponent(serviceName)}`);
      if (locality) query.push(`locality=${encodeURIComponent(locality)}`);
      const qs = query.length ? `?${query.join('&')}` : '';
      return await this.request(`/api/partners${qs}`);
    }

    async searchPartners(params = {}) {
      const q = new URLSearchParams();
      if (params.query) q.append('query', params.query);
      if (params.category) q.append('category', params.category);
      if (params.locality) q.append('locality', params.locality);
      if (params.min_rating) q.append('min_rating', params.min_rating);
      if (params.online_only) q.append('online_only', '1');
      const qs = q.toString() ? `?${q.toString()}` : '';
      return await this.request(`/api/partners/search${qs}`);
    }

    async getPartnerPublicProfile(partnerId) {
      return await this.request(`/api/partners/${partnerId}/public-profile`);
    }

    async getPartnerMyProfile() {
      return await this.request('/api/partners/profile/me');
    }

    async submitPartnerOnboarding(data) {
      return await this.request('/api/partners/onboarding', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    async uploadPartnerDocument(docData) {
      if (docData instanceof FormData) {
        const url = `${BASE_URL}/api/partners/documents/upload`;
        const headers = {};
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: docData,
          credentials: 'include'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Document upload failed');
        return data;
      }
      return await this.request('/api/partners/documents/upload', {
        method: 'POST',
        body: JSON.stringify(docData)
      });
    }

    async getPartnerDocuments() {
      return await this.request('/api/partners/documents');
    }

    async getPartnerAvailability() {
      return await this.request('/api/partners/availability');
    }

    async setPartnerOnlineStatus(isOnline) {
      return await this.request('/api/partners/availability/status', {
        method: 'POST',
        body: JSON.stringify({ is_online: isOnline ? 1 : 0 })
      });
    }

    async setPartnerWeeklySchedule(schedule) {
      return await this.request('/api/partners/availability/weekly', {
        method: 'POST',
        body: JSON.stringify({ schedule })
      });
    }

    async addPartnerAvailabilityException(data) {
      return await this.request('/api/partners/availability/exception', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    async deletePartnerAvailabilityException(exceptionId) {
      return await this.request(`/api/partners/availability/exception/${exceptionId}`, {
        method: 'DELETE'
      });
    }

    async updatePartnerLocation(latitude, longitude) {
      return await this.request('/api/partners/location/update', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude })
      });
    }

    async togglePartnerLocationSharing(isSharing) {
      return await this.request('/api/partners/location/toggle-sharing', {
        method: 'POST',
        body: JSON.stringify({ is_sharing: isSharing ? 1 : 0 })
      });
    }

    async uploadPartnerProfilePhoto(fileOrBase64) {
      if (fileOrBase64 instanceof File) {
        const formData = new FormData();
        formData.append('photo', fileOrBase64);
        const token = this.getToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${this.getBaseUrl()}/api/partners/profile-photo`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to upload profile photo');
        return data;
      } else {
        return await this.request('/api/partners/profile-photo', {
          method: 'POST',
          body: JSON.stringify({ photo_base64: fileOrBase64 })
        });
      }
    }

    // --- Addresses ---
    async getAddresses() {
      return await this.request('/api/addresses');
    }

    async addAddress(addressData) {
      return await this.request('/api/addresses', {
        method: 'POST',
        body: JSON.stringify(addressData)
      });
    }

    async updateAddress(addressId, addressData) {
      return await this.request(`/api/addresses/${addressId}`, {
        method: 'PUT',
        body: JSON.stringify(addressData)
      });
    }

    async deleteAddress(addressId) {
      return await this.request(`/api/addresses/${addressId}`, {
        method: 'DELETE'
      });
    }

    async setDefaultAddress(addressId) {
      return await this.request(`/api/addresses/${addressId}/default`, {
        method: 'POST'
      });
    }

    // --- Bookings ---
    async getBookings() {
      return await this.request('/api/bookings');
    }

    async createBooking(bookingData) {
      return await this.request('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
    }

    async acceptBooking(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/accept`, {
        method: 'POST'
      });
    }

    async rejectBooking(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/reject`, {
        method: 'POST'
      });
    }

    async declineBooking(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/decline`, {
        method: 'POST'
      });
    }

    async expandBookingSearch(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/expand-search`, {
        method: 'POST'
      });
    }

    async getBookingTracking(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/tracking`);
    }

    async getBookingChat(bookingId) {
      return await this.request(`/api/bookings/${bookingId}/chat`);
    }

    async sendBookingChatMessage(bookingId, message) {
      return await this.request(`/api/bookings/${bookingId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
    }

    async updateBookingStatus(bookingId, status) {
      return await this.request(`/api/bookings/${bookingId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
    }

    // --- Reviews & Complaints ---
    async getReviews() {
      return await this.request('/api/reviews');
    }

    async submitReview(bookingId, rating, comment) {
      return await this.request('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ booking_id: bookingId, rating, comment })
      });
    }

    async fileComplaint(bookingId, category, description) {
      return await this.request('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({ booking_id: bookingId, category, description })
      });
    }

    // --- Support Tickets ---
    async getSupportTickets() {
      return await this.request('/api/support-tickets');
    }

    async createSupportTicket(ticketData) {
      return await this.request('/api/support-tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData)
      });
    }

    // --- Admin Operations ---
    async adminLogin(email, password) {
      const data = await this.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    }

    async adminLogout() {
      try {
        await this.request('/api/admin/logout', { method: 'POST' });
      } finally {
        this.setToken(null);
      }
    }

    async getAdminDashboard() {
      return await this.request('/api/admin/dashboard');
    }

    async getAdminStats() {
      return await this.request('/api/admin/stats');
    }

    async getAdminBookings() {
      return await this.request('/api/admin/bookings');
    }

    async getAdminAnalytics() {
      return await this.request('/api/admin/analytics');
    }

    async getAdminCustomers() {
      return await this.request('/api/admin/customers');
    }

    async updateAdminCustomerStatus(customerId, status) {
      return await this.request(`/api/admin/customers/${customerId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
    }

    async getAdminPartners() {
      return await this.request('/api/admin/partners');
    }

    async updateAdminPartnerStatus(partnerId, status, actionType = 'account') {
      return await this.request(`/api/admin/partners/${partnerId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, action_type: actionType })
      });
    }

    async getAdminVerifications() {
      return await this.request('/api/admin/verifications');
    }

    async decideAdminVerification(verificationId, decision, notes = '', rejectionReason = '') {
      return await this.request(`/api/admin/verifications/${verificationId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes, rejection_reason: rejectionReason })
      });
    }

    async getAdminAuditLogs() {
      return await this.request('/api/admin/audit-logs');
    }

    async getAdminComplaints() {
      return await this.request('/api/admin/complaints');
    }

    async resolveAdminComplaint(complaintId, resolution, status = 'RESOLVED') {
      return await this.request(`/api/admin/complaints/${complaintId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution, status })
      });
    }

    async getAdminSupportTickets() {
      return await this.request('/api/admin/support-tickets');
    }

    async respondAdminSupportTicket(ticketId, response, status = 'RESOLVED') {
      return await this.request(`/api/admin/support-tickets/${ticketId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response, status })
      });
    }

    async createAdminService(serviceData) {
      return await this.request('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify(serviceData)
      });
    }

    async updateAdminService(serviceId, serviceData) {
      return await this.request(`/api/admin/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify(serviceData)
      });
    }

    async deleteAdminService(serviceId) {
      return await this.request(`/api/admin/services/${serviceId}`, {
        method: 'DELETE'
      });
    }

    async queryAdminAssistant(query) {
      return await this.request('/api/admin/assistant', {
        method: 'POST',
        body: JSON.stringify({ query })
      });
    }

    // --- Conversational Customer AI Assistant ---
    async chatAssistant(message, context = {}, history = []) {
      return await this.request('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message, context, history })
      });
    }

    async executeAssistantAction(action, data = {}) {
      return await this.request('/api/assistant/action', {
        method: 'POST',
        body: JSON.stringify({ action, data })
      });
    }

    // --- Notifications ---
    async getNotifications() {
      return await this.request('/api/notifications');
    }

    async markNotificationsRead() {
      return await this.request('/api/notifications', { method: 'POST' });
    }
  }

  root.API = new KaamSaathiAPI();

})(typeof window !== 'undefined' ? window : this);
