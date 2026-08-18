export function logoutAll() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("accessToken");
  sessionStorage.removeItem("pendingPasswordChangeUser");
  sessionStorage.removeItem("pendingPasswordChangeToken");
  sessionStorage.removeItem("googleLoginState");
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
