export function logoutAll() {
  localStorage.removeItem("currentUser");
  localStorage.setItem("logoutEvent", Date.now().toString());
}

export function readCurrentUser() {
  const rawUser = localStorage.getItem("currentUser");
  return rawUser ? JSON.parse(rawUser) : null;
}
