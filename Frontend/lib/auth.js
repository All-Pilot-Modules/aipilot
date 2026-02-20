import { jwtDecode } from 'jwt-decode';

// Remove trailing slash from API_BASE_URL to prevent double slashes
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Returns true for transient network errors that are worth retrying
const isRetryableError = (error) => {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.isTimeout === true ||
    error.name === 'TypeError' ||
    msg.includes('Failed to fetch') ||
    msg.includes('fetch') ||
    msg.includes('aborted') ||
    msg.includes('network') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('NetworkError')
  );
};

// Single fetch attempt with timeout
const fetchOnce = async (url, options = {}, timeout = 30000) => {
  // Prevent execution during SSR
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('SSR: not in browser');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeout}ms`, 'TimeoutError'));
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    // Wrap AbortError with a clearer message when it was caused by our timeout
    if (error.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${Math.round(timeout / 1000)}s`);
      timeoutErr.name = 'TimeoutError';
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw error;
  }
};

// Fetch with timeout + automatic retry for transient network errors
const fetchWithTimeout = async (url, options = {}, timeout = 30000, maxRetries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchOnce(url, options, timeout);
    } catch (error) {
      lastError = error;

      // Don't retry SSR errors or non-retryable errors
      if (error.message?.includes('SSR:') || !isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) break;

      // Exponential backoff: 800ms, 2000ms
      const delay = Math.min(800 * Math.pow(2.5, attempt), 5000);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[fetch] Retry ${attempt + 1}/${maxRetries} in ${delay}ms — ${url.replace(API_BASE_URL, '')}`);
      }
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
};

// Auth functions
export const auth = {
  // Login function
  async login(identifier, password) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier,
            password,
          }),
        },
        10000 // 10 second timeout
      );

      if (!response.ok) {
        let error;
        try {
          error = await response.json();
        } catch (e) {
          error = { detail: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();

      // Store tokens securely with HttpOnly, Secure, and SameSite flags
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieFlags = `path=/; max-age=${data.expires_in || 1800}; SameSite=Strict${isProduction ? '; Secure' : ''}`;

      // Store access token in cookie
      document.cookie = `token=${data.access_token}; ${cookieFlags}`;

      // Store refresh token securely (longer expiration)
      if (data.refresh_token) {
        const refreshCookieFlags = `path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict${isProduction ? '; Secure' : ''}`;
        document.cookie = `refresh_token=${data.refresh_token}; ${refreshCookieFlags}`;
      }

      // Store user data in sessionStorage (not sensitive token data)
      // If no user object in response, decode from token
      let userData = data.user;
      if (!userData && data.access_token) {
        try {
          const decoded = jwtDecode(data.access_token);
          userData = decoded;
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }

      if (userData) {
        console.log('💾 Storing user in sessionStorage:', userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
        // Also return userData in the response
        data.user = userData;
      }

      return data;
    } catch (error) {
      if (error.message.includes('fetch') || error.message.includes('timeout')) {
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  },

  // Register function
  async register(userData) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        },
        10000 // 10 second timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Logout function
  logout() {
    // Clear all auth-related storage
    sessionStorage.removeItem('user');

    // Clear cookies with proper flags
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict';

    // Use router navigation instead of window.location for better UX
    // Note: This will be called from context, so we'll redirect there
    return true;
  },

  // Get current user
  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    // First check sessionStorage for cached user data (faster than API call)
    if (typeof window !== 'undefined') {
      const cachedUser = sessionStorage.getItem('user');
      if (cachedUser) {
        try {
          return JSON.parse(cachedUser);
        } catch (e) {
          sessionStorage.removeItem('user');
        }
      }
    }

    // If not in cache, fetch from API with timeout
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/me`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        8000 // 8 second timeout
      );

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          return null;
        }
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();

      // Cache the user data in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('user', JSON.stringify(userData));
      }

      return userData;
    } catch (error) {
      this.logout();
      return null;
    }
  },

  // Get token from cookie
  getToken() {
    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
      if (tokenCookie) {
        // Use slice to handle JWT tokens with '=' characters in them
        return tokenCookie.trim().slice('token='.length);
      }
    }
    return null;
  },

  // Get refresh token from cookie
  getRefreshToken() {
    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split(';');
      const refreshCookie = cookies.find(c => c.trim().startsWith('refresh_token='));
      if (refreshCookie) {
        // Use slice to handle tokens with '=' characters in them
        return refreshCookie.trim().slice('refresh_token='.length);
      }
    }
    return null;
  },

  // Check if user is authenticated
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);
      return decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  },

  // Get user from token
  getUserFromToken() {
    const token = this.getToken();
    if (!token) return null;

    try {
      return jwtDecode(token);
    } catch {
      return null;
    }
  },

  // Refresh access token using refresh token
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        8000 // 8 second timeout
      );

      if (!response.ok) {
        this.logout();
        return null;
      }

      const data = await response.json();

      // Update access token cookie
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieFlags = `path=/; max-age=${data.expires_in || 1800}; SameSite=Strict${isProduction ? '; Secure' : ''}`;
      document.cookie = `token=${data.access_token}; ${cookieFlags}`;

      return data.access_token;
    } catch (error) {
      this.logout();
      return null;
    }
  },

  // Request password reset
  async requestPasswordReset(email) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/password-reset/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        },
        10000
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send reset email');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Verify reset code
  async verifyResetCode(email, code) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/password-reset/verify-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, code }),
        },
        10000
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid code');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Verify reset token (magic link)
  async verifyResetToken(token) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/password-reset/verify-token?token=${token}`,
        {},
        10000
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid reset link');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Reset password with code
  async resetPassword(email, code, newPassword) {
    try {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/auth/password-reset/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            code,
            new_password: newPassword,
          }),
        },
        10000
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reset password');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};

// API helper with authentication, auto-refresh, and retry
export const apiClient = {
  async request(endpoint, options = {}) {
    let token = auth.getToken();

    // Check if token is about to expire (within 5 minutes)
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const timeUntilExpiry = decoded.exp - Date.now() / 1000;

        // If token expires in less than 5 minutes, refresh it
        if (timeUntilExpiry < 300) {
          const newToken = await auth.refreshAccessToken();
          if (newToken) {
            token = newToken;
          }
        }
      } catch (error) {
        // Token validation failed, continue with existing token
      }
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    // Dynamic timeout and retries based on endpoint type
    let timeout = 15000; // Default: 15 seconds
    let retries = 2;     // Default: 2 retries (3 total attempts)

    if (endpoint.includes('/dashboard-metrics') || endpoint.includes('/performance')) {
      timeout = 45000; // Dashboard metrics: 45 seconds (heavy aggregation queries)
      retries = 1;     // 1 retry (data load, not critical path)
    } else if (endpoint.includes('/feedback') || endpoint.includes('/cleanup-feedback') || endpoint.includes('/feedback-status')) {
      timeout = 10000; // Feedback endpoints: 10 seconds
      retries = 1;     // 1 retry (fail fast, SSE/polling picks up)
    } else if (endpoint.includes('/submit-test')) {
      timeout = 30000; // Test submission: 30 seconds
      retries = 3;     // 3 retries (critical path)
    } else if (endpoint.includes('/consent')) {
      timeout = 15000;
      retries = 3;     // Consent is important, retry more
    }

    // Retry loop for network-level failures and 502/503/504
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          `${API_BASE_URL}${endpoint}`,
          config,
          timeout,
          0 // fetchWithTimeout handles its own retries; we handle higher-level retries here
        );

        // Server errors that indicate a restarting/overloaded backend — retry
        if (response.status >= 502 && response.status <= 504 && attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[apiClient] HTTP ${response.status} — retry ${attempt + 1}/${retries} in ${delay}ms`);
          }
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          if (response.status === 401) {
            // Try to refresh token once on 401
            const newToken = await auth.refreshAccessToken();
            if (newToken) {
              config.headers['Authorization'] = `Bearer ${newToken}`;
              const retryResponse = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, config, 15000, 1);
              if (retryResponse.ok) {
                return retryResponse.json();
              }
            }
            auth.logout();
            throw new Error('Authentication required');
          }

          const error = await response.json().catch(() => ({}));

          let errorMessage = `HTTP ${response.status}`;
          if (error.detail) {
            if (Array.isArray(error.detail)) {
              errorMessage = error.detail
                .map(err => `${err.loc?.join('.')}: ${err.msg}`)
                .join('; ');
            } else if (typeof error.detail === 'string') {
              errorMessage = error.detail;
            } else {
              errorMessage = JSON.stringify(error.detail);
            }
          }

          throw new Error(errorMessage);
        }

        return response.json();

      } catch (error) {
        lastError = error;

        // Only retry on transient network errors, not on auth/validation errors
        if (!isRetryableError(error) || attempt >= retries) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[apiClient] ${error.message} — retry ${attempt + 1}/${retries} in ${delay}ms — ${endpoint}`);
        }
        await new Promise(r => setTimeout(r, delay));
      }
    }

    throw lastError;
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  },
};