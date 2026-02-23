"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useRealtime, useCurrentRound } from "@/hooks/useRealtime";
import { useNotifications } from "@/hooks/useNotifications";
import { createClient } from "@/lib/supabase/client";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { Item, User } from "@/types";

export default function DashboardPage() {
  const { user, loading: userLoading, signOut } = useUser();
  const { roundId, loading: roundLoading } = useCurrentRound();
  const { round, items, users, onlineUsers, loading: dataLoading, refetch } = useRealtime(
    roundId,
    user
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [addingItem, setAddingItem] = useState(false);
  const [requestingItem, setRequestingItem] = useState(false);
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOnlineDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Separate requested items from active items
  const requestedItems = items.filter((item) => item.status === "requested");
  const activeItems = items.filter((item) => item.status === "active");

  const isShopper = round?.locked_by_user_id === user?.id;
  const isSomeoneShopping = round?.state === "LOCKED";
  // canShop: can add items directly (anyone in OPEN, shopper in LOCKED)
  const canShop = (round?.state === "OPEN") || (round?.state === "LOCKED" && isShopper);
  // canRequest: can only request items (non-shoppers when LOCKED)
  const canRequest = round?.state === "LOCKED" && !isShopper && user;
  // canToggleCart: only the SHOPPER can mark items as in-cart (when someone is shopping)
  const canToggleCart = isShopper && isSomeoneShopping;
  // canToggleCartVisible: toggle is visible to everyone, but only shopper can use it
  const canToggleCartVisible = isSomeoneShopping;
  // canDeleteItem: in OPEN state user can delete their own items, in LOCKED only shopper can delete
  const canDeleteItem = (item: Item) => {
    console.log("canDeleteItem check:", { userId: user?.id, itemOwnerId: item.created_by_user_id, isSomeoneShopping, isShopper });
    if (!user) return false;
    if (!isSomeoneShopping) {
      // OPEN state: user can delete their own items
      const canDelete = item.created_by_user_id === user.id;
      console.log("OPEN state - canDelete:", canDelete);
      return canDelete;
    }
    // LOCKED state: only shopper can delete
    const canDelete = isShopper;
    console.log("LOCKED state - canDelete:", canDelete);
    return canDelete;
  };

  // Enable notifications
  useNotifications({ roundId, currentUser: user });

  // Redirect if not logged in
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !roundId || !user) return;

    setAddingItem(true);
    const itemName = newItemName.trim();

    // Check for existing item (case-insensitive) created by this user
    const existingItem = items.find(
      (i) => i.name.toLowerCase() === itemName.toLowerCase() && i.created_by_user_id === user.id
    );

    if (existingItem) {
      // Increase quantity by 1
      await supabase
        .from("items")
        .update({ quantity: existingItem.quantity + 1 })
        .eq("id", existingItem.id);
    } else {
      // Insert new item
      await supabase.from("items").insert({
        round_id: roundId,
        name: itemName,
        quantity: newItemQuantity,
        created_by_user_id: user.id,
      });
    }

    setNewItemName("");
    setNewItemQuantity(1);
    setAddingItem(false);
  };

  const handleUpdateQuantity = async (item: Item, delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      await supabase.from("items").delete().eq("id", item.id);
    } else {
      await supabase.from("items").update({ quantity: newQuantity }).eq("id", item.id);
    }
  };

  const handleToggleInCart = async (item: Item) => {
    await supabase
      .from("items")
      .update({ is_in_cart: !item.is_in_cart })
      .eq("id", item.id);
  };

  const handleDeleteItem = async (itemId: string) => {
    console.log("Deleting item:", itemId);
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (error) {
      console.error("Delete error:", error);
    }
  };

  const handleLockRound = async () => {
    if (!roundId || !user) return;
    await supabase
      .from("rounds")
      .update({
        state: "LOCKED",
        locked_at: new Date().toISOString(),
        locked_by_user_id: user.id,
      })
      .eq("id", roundId);
  };

  const handleUnlockRound = async () => {
    if (!roundId) return;
    await supabase
      .from("rounds")
      .update({
        state: "OPEN",
        locked_at: null,
        locked_by_user_id: null,
      })
      .eq("id", roundId);
  };

  // Track last request time for rate limiting
  const lastRequestTime = useRef<number>(0);

  const handleRequestItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !roundId || !user) return;

    // Rate limit: 5 seconds between requests
    const now = Date.now();
    if (now - lastRequestTime.current < 5000) {
      alert("Niet zo snel! Wacht even voordat je nog een item aanvraagt.");
      return;
    }
    lastRequestTime.current = now;

    setRequestingItem(true);
    const { error } = await supabase.from("items").insert({
      round_id: roundId,
      name: newItemName.trim(),
      quantity: newItemQuantity,
      status: "requested",
      requested_by_user_id: user.id,
      created_by_user_id: user.id,
    });

    if (!error) {
      setNewItemName("");
      setNewItemQuantity(1);
    }
    setRequestingItem(false);
  };

  const handleApproveRequest = async (itemId: string) => {
    await supabase
      .from("items")
      .update({
        status: "active",
        requested_by_user_id: null,
      })
      .eq("id", itemId);
  };

  const handleDeclineRequest = async (itemId: string) => {
    await supabase.from("items").delete().eq("id", itemId);
  };

  const getUserById = (userId: string): User | undefined => {
    return users.find((u) => u.id === userId);
  };

  if (userLoading || roundLoading || dataLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Boodschappenlijst
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {round?.state === "OPEN" && "Open"}
              {round?.state === "LOCKED" && `Boodschappen door ${getUserById(round.locked_by_user_id || "")?.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2" ref={dropdownRef}>
            {/* Online users dropdown */}
            {onlineUsers.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowOnlineDropdown(!showOnlineDropdown)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {onlineUsers.length} {onlineUsers.length === 1 ? "persoon" : "personen"} kijken
                  </span>
                  <div className="flex -space-x-1">
                    {onlineUsers.slice(0, 3).map((u) => (
                      <div
                        key={u.user_id}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white dark:border-gray-800"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.user_name.charAt(0)}
                      </div>
                    ))}
                    {onlineUsers.length > 3 && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-400 text-white text-xs font-bold border border-white dark:border-gray-800">
                        +{onlineUsers.length - 3}
                      </div>
                    )}
                  </div>
                </button>
                {/* Dropdown */}
                {showOnlineDropdown && (
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Online nu
                      </span>
                    </div>
                    {onlineUsers.map((u) => (
                      <div
                        key={u.user_id}
                        className="px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: u.color }}
                        ></div>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {u.user_name}
                        </span>
                        {u.user_id === user?.id && (
                          <span className="text-xs text-gray-400">(jij)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={signOut}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* User info */}
        <div className="mb-4 flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: user.color }}
          ></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Ingelogd als {user.name}
          </span>
        </div>

        {/* Active Items */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Te kopen ({activeItems.length})
          </h2>
          <div className="space-y-2">
            <AnimatePresence>
              {activeItems.map((item, index) => {
                const creator = getUserById(item.created_by_user_id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white">
                        {item.name}
                      </span>
                      {/* Quantity controls for item owner */}
                      {item.created_by_user_id === user?.id && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateQuantity(item, -1)}
                            className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            -
                          </button>
                          {item.quantity > 1 && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                          )}
                          <button
                            onClick={() => handleUpdateQuantity(item, 1)}
                            className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center justify-center text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            +
                          </button>
                        </div>
                      )}
                      {item.created_by_user_id !== user?.id && item.quantity > 1 && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    {creator && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: creator.color }}
                        ></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {creator.name}
                        </span>
                      </div>
                    )}
                  </div>
                  {item.estimated_price && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      €{item.estimated_price.toFixed(2)}
                    </span>
                  )}
                  {/* In-cart toggle: visible to everyone, only shopper can toggle when shopping */}
                  <button
                    onClick={() => canToggleCart && handleToggleInCart(item)}
                    disabled={!canToggleCartVisible || !canToggleCart}
                    className={`p-1.5 rounded ${
                      item.is_in_cart
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                        : canToggleCart
                        ? "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        : canToggleCartVisible
                        ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                        : "text-gray-200 dark:text-gray-700 cursor-not-allowed"
                    }`}
                    title={!canToggleCartVisible ? "Niemand koopt" : (item.is_in_cart ? "In winkelwagen" : (canToggleCart ? "In winkelwagen" : "Alleen shopper kan dit wijzigen"))}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                  {/* Delete button: OPEN = own items, LOCKED = only shopper */}
                  {canDeleteItem(item) && (
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {activeItems.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                Geen items op de lijst
              </p>
            )}
          </div>
        </section>

        {/* Requested Items (Request Queue) */}
        {round?.state === "LOCKED" && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">
              Aangevraagde Items ({requestedItems.length})
            </h2>
            <div className="space-y-2">
              {requestedItems.map((item) => {
                const requester = getUserById(item.requested_by_user_id || "");
                return (
                  <div
                    key={item.id}
                    className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-center justify-between border border-amber-200 dark:border-amber-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      {requester && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: requester.color }}
                          ></div>
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            aangevraagd door {requester.name}
                          </span>
                        </div>
                      )}
                    </div>
                    {isShopper && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApproveRequest(item.id)}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"
                          title="Goedkeuren"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(item.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          title="Afwijzen"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {requestedItems.length === 0 && round?.state === "LOCKED" && (
                <p className="text-center text-amber-600 dark:text-amber-400 py-2 text-sm">
                  Geen openstaande verzoeken
                </p>
              )}
            </div>
          </section>
        )}

        {/* In Winkelwagen - only show when someone is shopping */}
        {isSomeoneShopping && items.filter(i => i.is_in_cart).length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              In winkelwagen ({items.filter(i => i.is_in_cart).length})
            </h2>
            <div className="space-y-2 opacity-60">
              {items.filter(i => i.is_in_cart).map((item) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  {item.quantity > 1 && <span className="text-xs text-gray-400">x{item.quantity}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add Item Form (OPEN state - direct add) or Request Form (LOCKED state) */}
        {(canShop || canRequest) && (
          <form
            onSubmit={canShop ? handleAddItem : handleRequestItem}
            className={`rounded-lg p-4 shadow-sm mb-6 ${
              canRequest
                ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                : "bg-white dark:bg-gray-800"
            }`}
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              {canShop ? "Item toevoegen" : "Item aanvragen"}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={canShop ? "Wat toevoegen?" : "Wat heb je nodig?"}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={(canShop ? addingItem : requestingItem) || !newItemName.trim()}
                  className={`px-4 py-2 font-medium rounded-lg disabled:opacity-50 ${
                    canRequest
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {canShop
                    ? addingItem
                      ? "..."
                      : "Toevoegen"
                    : requestingItem
                    ? "..."
                    : "Aanvragen"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Receipt Upload - shown when shopping */}
        {round?.state === "LOCKED" && isShopper && (
          <div className="mb-6">
            {!round.receipt_path ? (
              <ReceiptUpload
                roundId={roundId!}
                onUploadComplete={() => refetch()}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Bon geüpload
                  </span>
                  <a
                    href={`/receipt?roundId=${roundId}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Bekijk/Bewerk
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Round Actions */}
        {round?.state === "OPEN" && (
          <button
            onClick={handleLockRound}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
          >
            Ik ga boodschappen doen
          </button>
        )}
        {round?.state === "LOCKED" && isShopper && (
          <button
            onClick={handleUnlockRound}
            className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
          >
            Annuleren (weer open)
          </button>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-lg mx-auto flex justify-around">
          <a href="/dashboard" className="flex-1 py-3 text-center text-blue-600 font-medium">
            Lijst
          </a>
          <a href="/history" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Geschiedenis
          </a>
          <a href="/allocations" className="flex-1 py-3 text-center text-gray-500 dark:text-gray-400">
            Kosten
          </a>
        </div>
      </nav>
    </div>
  );
}
