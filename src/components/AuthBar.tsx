"use client";

import React, { useState, useEffect, useRef } from "react";
import { User } from "firebase/auth";
import {
  subscribeAuthState,
  signInWithGoogle,
  signOutUser,
  getStoredFirebaseConfig,
} from "../lib/firebase";
import { 
  BookmarkCheck, 
  LogOut, 
  ChevronDown, 
  Settings, 
  User as UserIcon,
  Loader2 
} from "lucide-react";

interface AuthBarProps {
  onOpenSettings: () => void;
  onOpenSavedModal?: () => void;
  user: User | null;
  setUser: (u: User | null) => void;
}

export function AuthBar({ onOpenSettings, onOpenSavedModal, user, setUser }: AuthBarProps) {
  const [loading, setLoading] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config = getStoredFirebaseConfig();
    setHasConfig(!!config);
    const unsubscribe = subscribeAuthState((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [setUser]);

  // 點擊選單外部自動關閉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = async () => {
    if (!hasConfig) {
      alert("請先點擊齒輪 ⚙️ 設定並貼入你的 Firebase 配置！");
      onOpenSettings();
      return;
    }
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err: unknown) {
      alert((err as Error).message || "登入失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setIsMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <div className="relative" ref={menuRef}>
          {/* 頭像膠囊按鈕 */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 pl-1.5 pr-2.5 py-1 rounded-full shadow-xs transition"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="w-6 h-6 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="text-xs font-semibold text-slate-700 max-w-[90px] truncate">
              {user.displayName || user.email?.split("@")[0]}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* 下拉選單 Modal */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[11px] text-slate-400 font-medium">已登入帳號</p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {user.email}
                </p>
              </div>

              <div className="py-1">
                {onOpenSavedModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenSavedModal();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition"
                  >
                    <BookmarkCheck className="w-4 h-4 text-indigo-500" />
                    <span>我的雲端字庫</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>系統與雲端設定</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>登出帳號</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleLogin}
          disabled={loading}
          className="text-xs font-semibold bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-full transition flex items-center gap-2 shadow-xs"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : (
            <span className="text-blue-600 font-bold">G</span>
          )}
          <span>{loading ? "連線中..." : "Google 登入"}</span>
        </button>
      )}

      {/* 設定按鈕 (未登入或習慣獨立點擊時使用) */}
      <button
        onClick={onOpenSettings}
        className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition shadow-xs"
        title="系統與 Firebase 設定"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}