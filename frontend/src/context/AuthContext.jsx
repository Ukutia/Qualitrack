import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { queryClient } from '../lib/queryClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOnboarding = useCallback(async () => {
    try {
      const res = await api.get('/onboarding');
      setOnboarding(res.data.onboarding ?? null);
      return res.data.onboarding ?? null;
    } catch {
      setOnboarding(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('qualitrack_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then(async (res) => {
        setUser(res.data.user);
        await loadOnboarding();
      })
      .catch(() => {
        localStorage.removeItem('qualitrack_token');
        setUser(null);
        setOnboarding(null);
        queryClient.clear();
      })
      .finally(() => setLoading(false));
  }, [loadOnboarding]);

  useEffect(() => {
    function refresh() {
      if (!localStorage.getItem('qualitrack_token')) return;

      api
        .get('/auth/me')
        .then(async (res) => {
          setUser(res.data.user);
          await loadOnboarding();
        })
        .catch(() => {});
    }

    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [loadOnboarding]);

  async function login(email, password) {
    queryClient.clear();

    const res = await api.post('/auth/login', { email, password });

    localStorage.setItem('qualitrack_token', res.data.token);
    setUser(res.data.user);
    await loadOnboarding();
  }

  const syncOnboardingSteps = useCallback(async (stepIds) => {
    const res = await api.post('/onboarding/sync', { stepIds });
    setOnboarding(res.data.onboarding);
    return res.data.onboarding;
  }, []);

  async function completeOnboardingStep(stepId) {
    const res = await api.post(
      `/onboarding/steps/${encodeURIComponent(stepId)}/complete`,
    );

    setOnboarding(res.data.onboarding);
    return res.data.onboarding;
  }

  async function skipOnboarding(section) {
    const res = await api.post(
      `/onboarding/sections/${encodeURIComponent(section)}/skip`,
    );

    setOnboarding(res.data.onboarding);
    return res.data.onboarding;
  }

  async function refreshOnboarding() {
    return loadOnboarding();
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
        syncOnboardingSteps,
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
