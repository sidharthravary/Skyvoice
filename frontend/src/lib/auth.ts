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

export function getToken():    string | null { return readCookie('skyvoice_token');    }
export function getRole():     string | null { return readCookie('skyvoice_role');     }
export function getUsername(): string | null { return readCookie('skyvoice_username'); }
export function getFullName(): string | null { return readCookie('skyvoice_fullname'); }
export function isAdmin():     boolean       { return getRole() === 'admin';           }

export function setAuth(
  token:    string,
  role:     string,
  username: string,
  fullName?: string
): void {
  writeCookie('skyvoice_token',    token,              COOKIE_MAX_AGE);
  writeCookie('skyvoice_role',     role,               COOKIE_MAX_AGE);
  writeCookie('skyvoice_username', username,           COOKIE_MAX_AGE);
  writeCookie('skyvoice_fullname', fullName || username, COOKIE_MAX_AGE);
}

export function logout(): void {
  deleteCookie('skyvoice_token');
  deleteCookie('skyvoice_role');
  deleteCookie('skyvoice_username');
  deleteCookie('skyvoice_fullname');
  window.location.href = '/login';
}
