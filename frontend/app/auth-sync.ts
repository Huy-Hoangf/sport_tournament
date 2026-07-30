const COMPANY_EMAIL_DOMAIN = "@tech.com";

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

  const currentUser = JSON.parse(rawUser);

  if (
    typeof currentUser?.email === "string" &&
    !currentUser.email.toLowerCase().endsWith(COMPANY_EMAIL_DOMAIN)
  ) {
    const localPart = currentUser.email.split("@")[0]?.trim().toLowerCase();

    if (localPart) {
      currentUser.email = `${localPart}${COMPANY_EMAIL_DOMAIN}`;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    }
  }

  return currentUser;
}

export function readAccessToken() {
  return localStorage.getItem("accessToken");
}
