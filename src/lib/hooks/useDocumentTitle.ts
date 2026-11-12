import { useEffect } from 'react';

const APP_NAME = 'WinTech';

/** Sets the browser tab title, e.g. "Clients · WinTech". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
