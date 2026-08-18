export function logoutAll() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("accessToken");
  sessionStorage.removeItem("pendingPasswordChangeUser");
  sessionStorage.removeItem("pendingPasswordChangeToken");
  sessionStorage.removeItem("googleLoginState");
  localStorage.setItem("logoutEvent", Date.now().toString());
}

export function redirectToLogin() {
  window.location.replace("/login");
}

export function readCurrentUser() {
  const rawUser = localStorage.getItem("currentUser");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    logoutAll();
    return null;
  }
}

export function readAccessToken() {
  return localStorage.getItem("accessToken");
}
