export function logoutAll() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("accessToken");
  localStorage.setItem("logoutEvent", Date.now().toString());
}

export function readCurrentUser() {
  const rawUser = localStorage.getItem("currentUser");

  if (!rawUser) {
    return null;
  }

  return JSON.parse(rawUser);
}

export function readAccessToken() {
  return localStorage.getItem("accessToken");
}
