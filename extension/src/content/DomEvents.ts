export function bodyAvailable(): Promise<void> {
  return new Promise((resolve) => {
    if (document.body) {
      resolve();
      return;
    }

    const observer = new MutationObserver((_mutations, observer) => {
      if (document.body) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

export function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const linkElement = document.createElement("link");
    linkElement.href = href;
    linkElement.type = "text/css";
    linkElement.rel = "stylesheet";
    const timeout = setTimeout(() => fail(), 15_000);
    const loaded = () => {
      clearTimeout(timeout);
      linkElement.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      clearTimeout(timeout);
      linkElement.removeEventListener("load", loaded);
      linkElement.remove();
      reject(new Error(`Unable to load viewer stylesheet: ${href}`));
    };
    linkElement.addEventListener("load", loaded, { once: true });
    linkElement.addEventListener("error", fail, { once: true });
    document.head.appendChild(linkElement);
  });
}

export function documentLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }

    window.addEventListener("load", resolve as () => void);
  });
}
