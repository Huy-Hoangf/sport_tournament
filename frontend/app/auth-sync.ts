export function logoutAll() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("accessToken");
  localStorage.setItem("logoutEvent", Date.now().toString());
}

export function readCurrentUser() {
  const rawUser = localStorage.getItem("currentUser");
  return rawUser ? JSON.parse(rawUser) : null;
}

export function readAccessToken() {
  return localStorage.getItem("accessToken");
}
