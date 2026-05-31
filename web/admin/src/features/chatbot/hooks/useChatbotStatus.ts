"use client";

import { useEffect, useState } from "react";
import { fetchChatbotStatus } from "../api/chatbot.api";

interface ChatbotStatus {
  enabled: boolean;
  loaded: boolean;
}

/**
 * Single fetch of `/chatbot/status`. Used to hide the sidebar entry
 * and the assistant page when a tenant hasn't been enabled. Returns
 * `{ loaded: false }` initially so we don't flash the menu item then
 * immediately remove it.
 */
export function useChatbotStatus(): ChatbotStatus {
  const [state, setState] = useState<ChatbotStatus>({
    enabled: false,
    loaded: false,
  });
  useEffect(() => {
    let cancelled = false;
    fetchChatbotStatus()
      .then((s) => {
        if (!cancelled) setState({ enabled: s.enabled, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setState({ enabled: false, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
