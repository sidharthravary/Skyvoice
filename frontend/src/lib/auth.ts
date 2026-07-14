import { getBackendUrl } from "@/lib/backend";

// The JWT (skyvoice_token) is an HttpOnly cookie set by the backend on
// login/register — page JavaScript can never read it. The cookies below are
// display/routing hints only; real authorization happens server-side.
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getRole():     string | null { return readCookie('skyvoice_role');     }
export function getUsername(): string | null { return readCookie('skyvoice_username'); }
export function getFullName(): string | null { return readCookie('skyvoice_fullname'); }
export function isAdmin():     boolean       { return getRole() === 'admin';           }
export function isLoggedIn(): boolean        { return getRole() !== null;              }

// The backend sets all auth cookies (including the HttpOnly token) on the
// login/register response; this mirrors the display values client-side.
export function setAuth(role: string, username: string, fullName?: string): void {
  writeCookie('skyvoice_role',     role,                 COOKIE_MAX_AGE);
  writeCookie('skyvoice_username', username,             COOKIE_MAX_AGE);
  writeCookie('skyvoice_fullname', fullName || username, COOKIE_MAX_AGE);
}

export function logout(): void {
  // The HttpOnly token cookie can only be cleared by the backend.
  fetch(`${getBackendUrl()}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});

  deleteCookie('skyvoice_role');
  deleteCookie('skyvoice_username');
  deleteCookie('skyvoice_fullname');
  window.location.href = '/login';
}
