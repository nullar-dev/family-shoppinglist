// Push notification service
// This runs in the browser to handle notifications

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      ...options,
    });
  }
}

// Notification types for the app
export type NotificationType =
  | "new_item"
  | "item_request"
  | "round_locked"
  | "round_opened"
  | "round_settled";

export function getNotificationMessage(type: NotificationType, data: Record<string, string>): { title: string; body: string } {
  switch (type) {
    case "new_item":
      return {
        title: "Nieuw item toegevoegd",
        body: `${data.userName} heeft "${data.itemName}" toegevoegd`,
      };
    case "item_request":
      return {
        title: "Item verzoek",
        body: `${data.userName} vraagt om "${data.itemName}"`,
      };
    case "round_locked":
      return {
        title: "Boodschappen gestart",
        body: `${data.userName} is boodschappen aan het doen`,
      };
    case "round_opened":
      return {
        title: "Nieuwe boodschappenlijst",
        body: "Er is een nieuwe boodschappenlijst aangemaakt",
      };
    case "round_settled":
      return {
        title: "Ronde afgerond",
        body: `Ronde van ${data.date} is afgerond - Totaal: €${data.total}`,
      };
    default:
      return {
        title: "Gezins Boodschappenlijst",
        body: "Er is iets veranderd",
      };
  }
}
