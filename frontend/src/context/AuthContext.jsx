import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { queryClient } from '../lib/queryClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('qualitrack_token');

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        setOnboarding(res.data.onboarding ?? null);
      })
      .catch(() => {
        localStorage.removeItem('qualitrack_token');
        setUser(null);
        setOnboarding(null);
        queryClient.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  // HU19 + HU23:
  // al volver a la pestaña se actualizan permisos y progreso del onboarding.
  useEffect(() => {
    function refresh() {
      if (!localStorage.getItem('qualitrack_token')) return;

      api
        .get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          setOnboarding(res.data.onboarding ?? null);
        })
        .catch(() => {});
    }

    window.addEventListener('focus', refresh);

    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function login(email, password) {
    queryClient.clear();

    const res = await api.post('/auth/login', {
      email,
      password,
    });

    localStorage.setItem('qualitrack_token', res.data.token);

    setUser(res.data.user);
    setOnboarding(res.data.onboarding ?? null);
  }

  async function completeOnboardingStep(stepId) {
    const res = await api.post(
      `/onboarding/steps/${encodeURIComponent(stepId)}/complete`,
    );

    setOnboarding(res.data.onboarding);

    return res.data.onboarding;
  }

  async function skipOnboarding() {
    const res = await api.post('/onboarding/skip');

    setOnboarding(res.data.onboarding);

    return res.data.onboarding;
  }

  async function refreshOnboarding() {
    const res = await api.get('/onboarding');

    setOnboarding(res.data.onboarding);

    return res.data.onboarding;
  }

  function logout() {
    localStorage.removeItem('qualitrack_token');

    setUser(null);
    setOnboarding(null);

    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        onboarding,
        loading,
        login,
        logout,
        completeOnboardingStep,
        skipOnboarding,
        refreshOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}