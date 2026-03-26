"use client";

import { useState } from "react";

import { api } from "@/trpc/react";

export function CustomerTestPanel() {
  const [customerId, setCustomerId] = useState("");
  const createCustomer = api.paykit.createCustomer.useMutation();
  const deleteCustomer = api.paykit.deleteCustomer.useMutation();

  return (
    <div className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Customer operations</h2>
        <p className="text-sm text-white/70">
          Create, fetch, and delete customers through the tRPC API.
        </p>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/40"
        disabled={createCustomer.isPending}
        onClick={() => createCustomer.mutate()}
      >
        {createCustomer.isPending ? "Creating..." : "Create demo customer"}
      </button>

      {createCustomer.data ? (
        <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          <p>
            Customer <span className="font-medium">{createCustomer.data.id}</span> synced
            successfully.
          </p>
          <pre className="overflow-x-auto text-xs text-emerald-100/80">
            {JSON.stringify(createCustomer.data, null, 2)}
          </pre>
        </div>
      ) : null}

      {createCustomer.error ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {createCustomer.error.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40"
          onChange={(event) => setCustomerId(event.target.value)}
          placeholder="Customer ID to delete"
          value={customerId}
        />
        <button
          type="button"
          className="rounded-full bg-red-500/20 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={deleteCustomer.isPending || !customerId}
          onClick={() => deleteCustomer.mutate({ id: customerId })}
        >
          Delete
        </button>
      </div>

      {deleteCustomer.data ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Customer deleted.
        </p>
      ) : null}
    </div>
  );
}
