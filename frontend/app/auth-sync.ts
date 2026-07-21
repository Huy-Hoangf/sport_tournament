export function logoutAll(){
    localStorage.removeItem("currentUser");
    localStorage.setItem("logoutEvent",Date.now().toString());
}