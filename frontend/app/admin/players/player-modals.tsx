import type React from "react";
import { AdminSelect } from "../shared/admin-select";
import { Modal, ModalActions } from "../admin-player-components";
import { COMPANY_EMAIL_DOMAIN } from "../lib/constants";
import type { ImportedPlayer, Player } from "../types/player";

export type PlayerModalType =
  | "createUser"
  | "createUserFromList"
  | "changePassword"
  | "renamePlayer"
  | "changeStatus"
  | "deletePlayer"
  | "deleteAllPlayers"
  | null;

export function PlayerModals({
  openModal,
  setOpenModal,
  fullName,
  setFullName,
  email,
  setEmail,
  newUserRole,
  setNewUserRole,
  isLoading,
  isSuperAdmin,
  players,
  selectedPlayer,
  setSelectedPlayer,
  renameFullName,
  setRenameFullName,
  renameEmail,
  setRenameEmail,
  renameRole,
  setRenameRole,
  importFileName,
  setImportFileName,
  importPlayers,
  setImportPlayers,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  createPlayer,
  handleImportFile,
  importPlayersFromList,
  changePassword,
  renamePlayer,
  changePlayerStatus,
  deletePlayer,
  deleteAllPlayers,
}: {
  openModal: PlayerModalType;
  setOpenModal: (modal: PlayerModalType) => void;
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  newUserRole: "ADMIN" | "PLAYER";
  setNewUserRole: (value: "ADMIN" | "PLAYER") => void;
  isLoading: boolean;
  isSuperAdmin: boolean;
  players: Player[];
  selectedPlayer: Player | null;
  setSelectedPlayer: (player: Player | null) => void;
  renameFullName: string;
  setRenameFullName: (value: string) => void;
  renameEmail: string;
  setRenameEmail: (value: string) => void;
  renameRole: "ADMIN" | "PLAYER";
  setRenameRole: (value: "ADMIN" | "PLAYER") => void;
  importFileName: string;
  setImportFileName: (value: string) => void;
  importPlayers: ImportedPlayer[];
  setImportPlayers: React.Dispatch<React.SetStateAction<ImportedPlayer[]>>;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  createPlayer: () => void;
  handleImportFile: (file: File | null) => void | Promise<void>;
  importPlayersFromList: () => void;
  changePassword: () => void;
  renamePlayer: () => void;
  changePlayerStatus: (status: Player["status"]) => void | Promise<void>;
  deletePlayer: () => void | Promise<void>;
  deleteAllPlayers: () => void | Promise<void>;
}) {
  return (
    <>
      {openModal === "createUser" && (
        <Modal title={newUserRole === "ADMIN" ? "New Admin" : "New Player"}>
          <p className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-[#8ed8ec]">
            Account role: {newUserRole === "ADMIN" ? "Administrator" : "Player"}
          </p>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <p className="mb-6 text-sm text-zinc-400">Default Password</p>

          <ModalActions
            cancel={() => {
              setNewUserRole("PLAYER");
              setOpenModal(null);
            }}
            confirm={createPlayer}
            confirmText={isLoading ? "Creating..." : "Create User"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "createUserFromList" && (
        <Modal title="Add Player From List">
          <label className="mb-4 flex min-h-[92px] cursor-pointer flex-col items-center justify-center rounded border border-dashed border-[#8ed8ec66] bg-[#070d0d] px-4 text-center text-zinc-300 transition hover:border-[#8ed8ec]">
            <span className="text-sm font-black uppercase tracking-[0.16em] text-[#8ed8ec]">
              Choose Excel File
            </span>
            <span className="mt-2 text-sm text-zinc-500">
              {importFileName || ".xlsx with name/full name/ho ten/email"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
              }}
            />
          </label>

          <p className="mb-3 text-sm text-zinc-400">
            If email is empty, it will be generated from player name
            {COMPANY_EMAIL_DOMAIN}.
          </p>

          {importPlayers.length > 0 && (
            <div className="mb-6 max-h-[190px] overflow-auto rounded border border-white/10 bg-[#070d0d]">
              <div className="border-b border-white/10 px-4 py-3 text-sm font-black text-[#8ed8ec]">
                Preview: {importPlayers.length} players
              </div>
              {importPlayers.slice(0, 6).map((player) => (
                <div
                  key={player.email}
                  className="border-b border-white/5 px-4 py-3 text-sm last:border-b-0"
                >
                  <p className="font-black text-white">{player.fullName}</p>
                  <p className="text-zinc-400">{player.email}</p>
                </div>
              ))}
            </div>
          )}

          <ModalActions
            cancel={() => {
              setImportFileName("");
              setImportPlayers([]);
              setOpenModal(null);
            }}
            confirm={importPlayersFromList}
            confirmText={isLoading ? "Importing..." : "Import"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "changePassword" && (
        <Modal title="Change Password">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="mb-6 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <ModalActions
            cancel={() => setOpenModal(null)}
            confirm={changePassword}
            confirmText="Save Password"
          />
        </Modal>
      )}

      {openModal === "renamePlayer" && (
        <Modal title="Edit User">
          <p className="mb-3 text-sm text-zinc-400">
            {selectedPlayer?.email}
          </p>

          <input
            value={renameFullName}
            onChange={(event) => setRenameFullName(event.target.value)}
            placeholder="New user name"
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          <input
            value={renameEmail}
            onChange={(event) => setRenameEmail(event.target.value)}
            placeholder={`name${COMPANY_EMAIL_DOMAIN}`}
            className="mb-4 h-[54px] w-full rounded border border-white/10 bg-[#070d0d] px-4 text-zinc-100 outline-none focus:border-[#8ed8ec]"
          />

          {isSuperAdmin && selectedPlayer?.role !== "SUPER_ADMIN" && (
            <label className="mb-6 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#8ed8ec]">
                Account role
              </span>
              <AdminSelect
                value={renameRole}
                options={[
                  { value: "PLAYER", label: "Player" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
                onChange={(nextValue) =>
                  setRenameRole(nextValue as "ADMIN" | "PLAYER")
                }
                ariaLabel="Account role"
                className="w-full"
              />
            </label>
          )}

          <ModalActions
            cancel={() => {
              setSelectedPlayer(null);
              setRenameFullName("");
              setRenameEmail("");
              setRenameRole("PLAYER");
              setOpenModal(null);
            }}
            confirm={renamePlayer}
            confirmText={isLoading ? "Saving..." : "Save User"}
            disabled={isLoading}
          />
        </Modal>
      )}

      {openModal === "changeStatus" && (
        <Modal title="Change Player Status">
          <p className="mb-5 text-sm text-zinc-400">
            {selectedPlayer?.fullName} - {selectedPlayer?.email}
          </p>

          <div className="mb-6 grid gap-3">
            {(["ACTIVE", "INACTIVE", "PENDING"] as Player["status"][]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => void changePlayerStatus(status)}
                  disabled={isLoading}
                  className={`flex h-[50px] items-center justify-between rounded border px-4 text-left font-black uppercase tracking-[0.12em] transition disabled:opacity-60 ${
                    selectedPlayer?.status === status
                      ? "border-[#8ed8ec] bg-[#17343b] text-[#8ed8ec]"
                      : "border-white/10 bg-[#070d0d] text-zinc-200 hover:border-[#8ed8ec66]"
                  }`}
                >
                  <span>{status}</span>
                  {selectedPlayer?.status === status && (
                    <span className="text-xs">CURRENT</span>
                  )}
                </button>
              ),
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setSelectedPlayer(null);
                setOpenModal(null);
              }}
              disabled={isLoading}
              className="h-[46px] rounded border border-white/10 px-5 text-zinc-300 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {openModal === "deletePlayer" && selectedPlayer && (
        <Modal title="Delete Player" tone="danger">
          <p className="text-base font-bold text-white">
            Do you want to delete this player?
          </p>
          <div className="my-5 rounded border border-[#ff6b6b66] bg-[#35171b] px-4 py-4">
            <p className="font-black text-[#ff8a8a]">
              {selectedPlayer.fullName}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {selectedPlayer.email} - {selectedPlayer.memberCode}
            </p>
          </div>
          <p className="mb-6 text-sm text-zinc-400">
            This action cannot be undone.
          </p>
          <ModalActions
            cancel={() => {
              setOpenModal(null);
              setSelectedPlayer(null);
            }}
            confirm={() => void deletePlayer()}
            confirmText={isLoading ? "Deleting..." : "Delete"}
            disabled={isLoading}
            danger
          />
        </Modal>
      )}

      {isSuperAdmin && openModal === "deleteAllPlayers" && (
        <Modal title="Delete All Players" tone="danger">
          <p className="text-base font-bold text-white">
            Do you want to delete all players?
          </p>
          <p className="my-5 rounded border border-[#ff6b6b66] bg-[#35171b] px-4 py-4 text-sm text-[#ff8a8a]">
            {players.filter((player) => player.role === "PLAYER").length} player
            accounts will be deleted. The admin account will be kept.
          </p>
          <p className="mb-6 text-sm text-zinc-400">
            This action cannot be undone.
          </p>
          <ModalActions
            cancel={() => setOpenModal(null)}
            confirm={() => void deleteAllPlayers()}
            confirmText={isLoading ? "Deleting..." : "Delete All"}
            disabled={isLoading}
            danger
          />
        </Modal>
      )}
    </>
  );
}
