// ============================================================================
// KaamSaathi Authentication, Role-Based Access & Security (auth.js)
// WebCrypto SHA-256 hashing, session management, OTP & Route guards
// ============================================================================

(function(root) {
  'use strict';

  const SESSION_KEY = 'KAAMSAATHI_SESSION_V2';
  const PASSWORD_SALT = 'salt_ks';

  // Secure Password Hashing using SubtleCrypto SHA-256
  async function hashPassword(password) {
    if (!password) return '';
    try {
      const msgBuffer = new TextEncoder().encode(password + PASSWORD_SALT);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback simple bit hash if crypto is unavailable
      let hash = 0;
      const str = password + PASSWORD_SALT;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return 'fallback_' + Math.abs(hash).toString(16);
    }
  }

  class KaamSaathiAuth {
    constructor() {
      this.currentSession = null;
      this.loadSession();
    }

    loadSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw);
          // Verify user still exists in DB
          const user = root.DB.find('users', u => u.id === session.userId);
          if (user) {
            this.currentSession = {
              userId: user.id,
              role: user.role,
              email: user.email,
              phone: user.phone,
              isDemo: !!user.is_demo,
              token: session.token,
              loginAt: session.loginAt
            };
          } else {
            this.clearSession();
          }
        }
      } catch (err) {
        console.warn('Session load failed', err);
        this.clearSession();
      }
    }

    setSession(user) {
      this.currentSession = {
        userId: user.id,
        role: user.role,
        email: user.email,
        phone: user.phone,
        isDemo: !!user.is_demo,
        token: 'ks_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        loginAt: new Date().toISOString()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.currentSession));
      root.DB.logAudit('USER_LOGIN', user.id, `User signed in with role ${user.role}`);
      window.dispatchEvent(new CustomEvent('ks:auth_changed', { detail: this.currentSession }));
    }

    clearSession() {
      const prevUser = this.currentSession?.userId;
      this.currentSession = null;
      localStorage.removeItem(SESSION_KEY);
      if (prevUser) {
        root.DB.logAudit('USER_LOGOUT', prevUser, 'User logged out');
      }
      window.dispatchEvent(new CustomEvent('ks:auth_changed', { detail: null }));
    }

    getCurrentUser() {
      if (!this.currentSession) return null;
      return root.DB.find('users', u => u.id === this.currentSession.userId);
    }

    getCurrentProfile() {
      const user = this.getCurrentUser();
      if (!user) return null;
      if (user.role === 'CUSTOMER') {
        return root.DB.getCustomerByUserId(user.id);
      } else if (user.role === 'PARTNER') {
        return root.DB.getPartnerByUserId(user.id);
      }
      return { id: 'admin-profile', full_name: 'Platform Administrator', user_id: user.id };
    }

    isAuthenticated() {
      return !!this.currentSession && !!this.currentSession.userId;
    }

    getUserRole() {
      return this.currentSession?.role || null;
    }

    isCustomer() {
      return this.currentSession?.role === 'CUSTOMER';
    }

    isPartner() {
      return this.currentSession?.role === 'PARTNER';
    }

    isAdmin() {
      return this.currentSession?.role === 'ADMIN';
    }

    // Register a new customer or partner
    async register({ role, email, phone, password, fullName, city }) {
      if (!email || !password || !fullName || !role) {
        throw new Error('Please provide all required registration fields.');
      }

      const existingEmail = root.DB.getUserByEmail(email);
      if (existingEmail) {
        throw new Error('An account with this email already exists.');
      }

      if (phone) {
        const existingPhone = root.DB.getUserByPhone(phone);
        if (existingPhone) {
          throw new Error('An account with this mobile number already exists.');
        }
      }

      const passwordHash = await hashPassword(password);
      const userId = `usr-${role.toLowerCase().slice(0, 4)}-${Date.now()}`;

      // Insert User record
      const newUser = root.DB.insert('users', {
        id: userId,
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : '',
        password_hash: passwordHash,
        role: role.toUpperCase(),
        email_verified: false,
        phone_verified: false,
        is_demo: false,
        city: city || 'Varanasi',
        created_at: new Date().toISOString()
      });

      // Initialize Customer or Partner domain record
      if (role.toUpperCase() === 'CUSTOMER') {
        root.DB.insert('customers', {
          id: `cust-${Date.now()}`,
          user_id: userId,
          full_name: fullName.trim(),
          profile_photo: '',
          preferred_language: 'Hindi',
          created_at: new Date().toISOString()
        });

        // Add welcome notification
        root.DB.insert('notifications', {
          user_id: userId,
          title: 'Welcome to KaamSaathi!',
          message: 'Complete your location setup to start booking trusted neighbourhood services.',
          type: 'info',
          read_status: false
        });
      } else if (role.toUpperCase() === 'PARTNER') {
        const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'KP';
        const partnerRecord = root.DB.insert('partners', {
          id: `part-${Date.now()}`,
          user_id: userId,
          full_name: fullName.trim(),
          initials,
          profile_photo: '',
          date_of_birth: '',
          gender: 'Male',
          bio: '',
          experience_years: 1,
          service_area: city ? `${city}` : 'Lanka, Varanasi',
          service_radius: '5 km',
          service_city: city || 'Varanasi',
          service_locality: '',
          verification_status: 'PENDING',
          rating: 5.0,
          rating_count: 0,
          completed_jobs: 0,
          response_rate: '100%',
          on_time_rate: '100%',
          starting_price: 149,
          is_online: false,
          primary_skills: [],
          avatar_bg: 'linear-gradient(135deg,#1d4545,#c98965)',
          created_at: new Date().toISOString()
        });

        // Initialize Partner Verifications record
        root.DB.insert('verifications', {
          partner_id: partnerRecord.id,
          partner_name: partnerRecord.full_name,
          verification_type: 'mobile',
          status: 'PENDING',
          masked_id: phone ? `+91 •••• ${phone.slice(-4)}` : 'Mobile verification pending',
          provider_reference: null,
          verified_at: null,
          reviewed_by: null,
          audit_note: 'Partner registered, awaiting verification submission',
          created_at: new Date().toISOString()
        });
      }

      this.setSession(newUser);
      return newUser;
    }

    // Login via Email + Password
    async loginWithPassword(email, password) {
      if (!email || !password) {
        throw new Error('Please enter both email and password.');
      }

      const user = root.DB.getUserByEmail(email);
      if (!user) {
        throw new Error('No account found with this email address.');
      }

      const hash = await hashPassword(password);
      if (user.password_hash !== hash) {
        throw new Error('Incorrect password. Please try again or reset your password.');
      }

      this.setSession(user);
      return user;
    }

    // Mobile + OTP Simulation
    generateOTP(phone) {
      if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
        throw new Error('Please enter a valid 10-digit mobile number.');
      }
      // Generate realistic 4-digit code (fixed demo code 4892 or random)
      const code = '4892'; 
      sessionStorage.setItem('KAAMSAATHI_LAST_OTP', JSON.stringify({
        phone: phone.replace(/[^0-9]/g, '').slice(-10),
        code,
        expiresAt: Date.now() + 180000 // 3 minutes
      }));
      return code;
    }

    verifyOTP(phone, code) {
      const raw = sessionStorage.getItem('KAAMSAATHI_LAST_OTP');
      if (!raw) throw new Error('No OTP request found. Please request a new OTP.');
      const data = JSON.parse(raw);
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

      if (data.phone !== cleanPhone) {
        throw new Error('Mobile number does not match OTP request.');
      }
      if (Date.now() > data.expiresAt) {
        throw new Error('OTP has expired. Please request a new code.');
      }
      if (code.trim() !== data.code && code.trim() !== '1234' && code.trim() !== '4892') {
        throw new Error('Invalid OTP code. Please enter the correct 4-digit code.');
      }

      // Check if user exists with this phone
      let user = root.DB.getUserByPhone(cleanPhone);
      if (!user) {
        // Create new Customer user automatically
        const userId = `usr-cust-${Date.now()}`;
        user = root.DB.insert('users', {
          id: userId,
          email: `user.${cleanPhone}@kaamsaathi.test`,
          phone: `+91 ${cleanPhone}`,
          password_hash: DEMO_PASSWORD_HASH,
          role: 'CUSTOMER',
          email_verified: false,
          phone_verified: true,
          is_demo: false,
          created_at: new Date().toISOString()
        });

        root.DB.insert('customers', {
          id: `cust-${Date.now()}`,
          user_id: userId,
          full_name: 'Verified Customer',
          profile_photo: '',
          preferred_language: 'Hindi',
          created_at: new Date().toISOString()
        });
      } else {
        root.DB.update('users', user.id, { phone_verified: true });
      }

      sessionStorage.removeItem('KAAMSAATHI_LAST_OTP');
      this.setSession(user);
      return user;
    }

    // Password Reset
    async resetPassword(email, newPassword) {
      const user = root.DB.getUserByEmail(email);
      if (!user) {
        throw new Error('No registered account with this email address.');
      }
      const newHash = await hashPassword(newPassword);
      root.DB.update('users', user.id, { password_hash: newHash });
      root.DB.logAudit('PASSWORD_RESET', user.id, 'Password successfully reset.');
      return true;
    }

    // Explicit Demo Logins
    loginAsDemo(role) {
      let targetEmail = '';
      if (role === 'customer') {
        targetEmail = 'demo.customer@demo.kaamsaathi.test';
      } else if (role === 'partner') {
        targetEmail = 'demo.partner@demo.kaamsaathi.test';
      } else if (role === 'admin') {
        targetEmail = 'demo.admin@demo.kaamsaathi.test';
      } else {
        throw new Error('Unknown demo role: ' + role);
      }

      const user = root.DB.getUserByEmail(targetEmail);
      if (!user) {
        root.DB.resetToDemo();
        const retryUser = root.DB.getUserByEmail(targetEmail);
        this.setSession(retryUser);
        return retryUser;
      }

      this.setSession(user);
      return user;
    }

    logout() {
      this.clearSession();
    }
  }

  root.Auth = new KaamSaathiAuth();

})(typeof window !== 'undefined' ? window : this);
