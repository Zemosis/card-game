import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getGuestIdentity, clearGuestIdentity } from "../lib/guestIdentity";
import { deserializeAvatar } from "../utils/avatarConstants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const guest = getGuestIdentity();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) fetchProfile(session.user.id);
        else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signInWithOAuth(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function updateProfile(updates) {
    if (!session) return;
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, ...updates })
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  }

  const isGuest = !session;

  const customAvatar = profile?.custom_avatar ? deserializeAvatar(profile.custom_avatar) : null;

  const customColors = profile?.custom_colors || [];

  const identity = isGuest
    ? { name: guest.name, tag: guest.tag, avatar: guest.avatar, customAvatar: null, customColors: [] }
    : {
        name: profile?.username || guest.name,
        tag: profile?.tag || guest.tag,
        avatar: profile?.avatar || guest.avatar,
        customAvatar,
        customColors,
      };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isGuest,
        identity,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        updateProfile,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
