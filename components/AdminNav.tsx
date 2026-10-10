'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { SidebarPanelIcon } from './icons';

const STORAGE_KEY = 'factfinder-admin-nav';

type AdminNavContextValue = {
  open: boolean; // 넓은 화면: 왼쪽 고정 메뉴 펼침
  toggle: () => void;
  drawer: boolean; // 폰: 왼쪽에서 나오는 메뉴 서랍 (2026-10-10 — 상단 로고가 버튼 역할)
  setDrawer: (v: boolean | ((prev: boolean) => boolean)) => void;
};

const AdminNavContext = createContext<AdminNavContextValue>({
  open: true,
  toggle: () => {},
  drawer: false,
  setDrawer: () => {},
});

export function useAdminNav() {
  return useContext(AdminNavContext);
}

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '0') setOpen(false);
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  return <AdminNavContext.Provider value={{ open, toggle, drawer, setDrawer }}>{children}</AdminNavContext.Provider>;
}

export function AdminSidebarToggle() {
  const { open, toggle } = useAdminNav();

  return (
    <button
      type="button"
      className={`icon-button admin-nav-toggle${open ? ' is-on' : ''}`}
      aria-label={open ? '관리자 메뉴 숨기기' : '관리자 메뉴 보이기'}
      aria-pressed={open}
      title={open ? '메뉴 숨기기' : '메뉴 보이기'}
      onClick={toggle}
    >
      <SidebarPanelIcon />
    </button>
  );
}

export function WriteShell({ children }: { children: React.ReactNode }) {
  return <div className="page-shell backstage flex flex-col md:flex-row items-stretch md:items-start gap-2 md:gap-6">{children}</div>;
}
