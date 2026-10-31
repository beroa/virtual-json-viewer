import * as Activator from "@/content/Activator";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

async function isHtmlDocument(): Promise<boolean> {
  if (!document.documentElement) {
    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.documentElement) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document, { childList: true });
    });
  }

  return document.documentElement?.namespaceURI === HTML_NAMESPACE;
}

async function getLoader(): Promise<typeof import("@/content/Loader") | null> {
  // React DOM assumes an HTML document. Content scripts also run on XML,
  // image, and other non-HTML responses, where its feature detection can
  // throw before the extension has a chance to activate.
  if (!(await isHtmlDocument())) return null;

  return import(
    /* @vite-ignore */ chrome.runtime.getURL("pages/loader.js")
  );
}

if (Activator.isJsonContentType()) {
  getLoader()
    .then((Loader) => Loader?.loadIncrementally())
    .catch((reason) => console.error(reason));
} else {
  Activator.checkActivationSetting()
    .then((forceActivation: boolean) => {
      if (forceActivation) {
        getLoader()
          .then((Loader) => Loader?.tryLoadAfterDocumentLoaded())
          .catch((reason) => console.error(reason));
      }
    })
    .catch((reason) => console.error(reason));
}
