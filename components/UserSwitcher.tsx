"use client";

import { useState } from "react";
import { useUser } from "./UserContext";

export default function UserSwitcher() {
  const { users, currentUser, selectUser, addUser } = useUser();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleAddUser = async () => {
    if (!name.trim() || !email.trim()) return;
    await addUser(name.trim(), email.trim());
    setName("");
    setEmail("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
        Profiles
      </p>

      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => selectUser(user)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
            currentUser?.id === user.id
              ? "bg-brand text-white"
              : "hover:bg-gray-100"
          }`}
        >
          {user.name}
        </button>
      ))}

      <button
        onClick={() => setShowAddModal(true)}
        className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand border border-dashed border-brand"
      >
        + Add User
      </button>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 space-y-3">
            <h3 className="font-semibold text-lg">Add User</h3>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-3 py-1.5 text-sm rounded-lg bg-brand text-white"
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}