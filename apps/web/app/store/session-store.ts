import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

interface SessionData {
  sessionId: string
  filename: string
  uploadTime: string
  pageCount?: number
}

interface SessionState {
  session: SessionData | null
  setSession: (data: SessionData) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (data) => set({ session: data }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: "pdf-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
