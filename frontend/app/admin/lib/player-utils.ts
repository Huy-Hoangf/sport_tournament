import { COMPANY_EMAIL_DOMAIN } from "./constants";
import type { BackendUser, ImportedPlayer, Player } from "../types/player";

export function mapUserToPlayer(user: BackendUser): Player {
  return {
    id: String(user.id),
    memberCode: user.memberCode ?? `GC-${String(user.id).padStart(4, "0")}`,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    rank: user.role === "PLAYER" ? "ROOKIE" : "ELITE",
    points: 0,
    status: user.status ?? "ACTIVE",
    events: user.eventsCount ?? 0,
  };
}

export function parsePlayersFromRows(
  rows: unknown[][],
  existingPlayers: Player[],
): ImportedPlayer[] {
  const usedEmails = new Set(
    existingPlayers.map((player) => player.email.toLowerCase()),
  );
  const usedNames = new Set(
    existingPlayers.map((player) => normalizePlayerName(player.fullName)),
  );
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const value = normalizeHeader(cell);
      return isEmailHeader(value) || isNameHeader(value);
    }),
  );
  const importedPlayers: ImportedPlayer[] = [];

  if (headerIndex >= 0) {
    const headers = rows[headerIndex].map(normalizeHeader);
    const nameColumn = headers.findIndex(isNameHeader);
    const emailColumn = headers.findIndex(isEmailHeader);

    if (nameColumn < 0) {
      return collectPlayersFromBestNameColumn(rows, usedNames, usedEmails);
    }

    for (const row of rows.slice(headerIndex + 1)) {
      const fullName = readCell(row[nameColumn]);

      if (!looksLikePlayerName(fullName)) {
        continue;
      }

      const normalizedName = normalizePlayerName(fullName);

      if (usedNames.has(normalizedName)) {
        continue;
      }

      const rawEmail = emailColumn >= 0 ? readCell(row[emailColumn]) : "";
      const email = buildImportEmail(fullName, rawEmail, usedEmails);

      if (!email) {
        continue;
      }

      usedNames.add(normalizedName);
      importedPlayers.push({ fullName, email });
    }

    return importedPlayers;
  }

  return collectPlayersFromBestNameColumn(rows, usedNames, usedEmails);
}

function collectPlayersFromBestNameColumn(
  rows: unknown[][],
  usedNames: Set<string>,
  usedEmails: Set<string>,
): ImportedPlayer[] {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  let bestColumn = 0;
  let bestScore = 0;

  for (let column = 0; column < columnCount; column += 1) {
    const score = rows.reduce((total, row) => {
      const value = readCell(row[column]);
      return total + (looksLikePlayerName(value) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestColumn = column;
      bestScore = score;
    }
  }

  const importedPlayers: ImportedPlayer[] = [];

  for (const row of rows) {
    const fullName = readCell(row[bestColumn]);

    if (!looksLikePlayerName(fullName)) {
      continue;
    }

    const normalizedName = normalizePlayerName(fullName);

    if (usedNames.has(normalizedName)) {
      continue;
    }

    const email = buildImportEmail(fullName, "", usedEmails);

    if (!email) {
      continue;
    }

    usedNames.add(normalizedName);
    importedPlayers.push({ fullName, email });
  }

  return importedPlayers;
}

function isNameHeader(header: string) {
  return [
    "name",
    "full name",
    "fullname",
    "player",
    "player name",
    "member",
    "member name",
    "user",
    "user name",
    "username",
    "ho ten",
    "ho va ten",
    "hoten",
    "ten",
    "ten nguoi choi",
    "nguoi choi",
    "ten nhan vien",
    "nhan vien",
    "ten thanh vien",
    "thanh vien",
  ].includes(header);
}

function isEmailHeader(header: string) {
  return ["email", "mail", "e-mail", "gmail", "company email"].includes(
    header,
  );
}

function looksLikePlayerName(value: string) {
  if (!value || value.length < 2 || value.includes("@")) {
    return false;
  }

  const normalized = normalizeHeader(value);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const punctuationCount = (value.match(/[.!?:;,/\\|()[\]{}]/g) ?? []).length;
  const blockedValues = new Set([
    "name",
    "full name",
    "player",
    "email",
    "mail",
    "stt",
    "no",
    "id",
    "ma",
    "member id",
    "ho ten",
    "ten",
    "nguoi choi",
    "toan bo nhan vien",
    "chon doi",
    "cau thu xinh",
  ]);

  if (blockedValues.has(normalized) || /^\d+$/.test(normalized)) {
    return false;
  }

  if (
    value.length > 48 ||
    wordCount > 6 ||
    punctuationCount > 1 ||
    normalized.includes("khong can biet") ||
    normalized.includes("chon doi") ||
    normalized.includes("du doan") ||
    normalized.includes("minigame") ||
    normalized.includes("world cup") ||
    normalized.includes("cau thu xinh") ||
    normalized.includes("hop ly")
  ) {
    return false;
  }

  return /[a-zA-Z\u00C0-\u1EF9]/.test(value);
}

function buildImportEmail(
  fullName: string,
  rawEmail: string,
  usedEmails: Set<string>,
) {
  const normalizedRawEmail = rawEmail.trim().toLowerCase();
  const generatedLocalPart = slugifyName(fullName) || "player";
  let email = normalizedRawEmail;

  if (email) {
    if (!isValidEmail(email)) {
      const [localPart] = email.split("@");
      email = `${localPart || generatedLocalPart}${COMPANY_EMAIL_DOMAIN}`;
    }

    if (usedEmails.has(email)) {
      return null;
    }

    usedEmails.add(email);
    return email;
  }

  const localPart = generatedLocalPart;
  email = `${localPart}${COMPANY_EMAIL_DOMAIN}`;

  if (usedEmails.has(email)) {
    return null;
  }

  usedEmails.add(email);
  return email;
}

function normalizePlayerName(name: string) {
  return slugifyName(name);
}

function slugifyName(name: string) {
  const withoutVietnameseD = name.replace(/đ/g, "d").replace(/Đ/g, "D");
  const normalized = withoutVietnameseD
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const words = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.join(".");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email);
}

function normalizeHeader(value: unknown) {
  return readCell(value)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}
