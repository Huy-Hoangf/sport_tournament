import type { CurrentUser } from "../../api";
import type { Player } from "../types/player";

export function canRenameUser(user: Player, currentUser: CurrentUser | null) {
  if (!currentUser || currentUser.role === "PLAYER") {
    return false;
  }

  if (user.role === "SUPER_ADMIN") {
    return false;
  }

  if (currentUser.role === "SUPER_ADMIN") {
    return true;
  }

  return user.role === "PLAYER" || Number(user.id) === currentUser.id;
}
