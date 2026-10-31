import { App as ViewerApp } from "@/viewer/App";
import * as Json from "@/viewer/commons/Json";
import { createRoot, Root } from "react-dom/client";
import * as DomEvents from "./DomEvents";

const FAVICON_URL = chrome.runtime.getURL("assets/logo/16.png");
const CONTENT_CSS_URL = chrome.runtime.getURL("assets/content.css");

export function loadIncrementally() {
  DomEvents.bodyAvailable()
    .then(() => {
      showLoading();
      return Promise.all([setupResources(), DomEvents.documentLoaded()]);
    })
    .then(loadViewer)
    .catch(handleLoadError);
}

export function tryLoadAfterDocumentLoaded() {
  DomEvents.documentLoaded()
    .then(checkResourcesAccess)
    .then(forceSetupAndLoadViewer)
    .catch(handleLoadError);
}

function setupResources(): Promise<void> {
  addFavicon(FAVICON_URL);
  updateTitle();
  return DomEvents.loadStylesheet(CONTENT_CSS_URL);
}

function loadViewer() {
  const jsonElement = document.getElementsByTagName("pre")[0];
  if (!jsonElement) throw new Error("JSON expected but not found");
  renderViewer(jsonElement.innerText);
}

async function forceSetupAndLoadViewer() {
  const jsonText = tryFindJsonText();
  if (!jsonText) {
    throw new Error("JSON expected but not found");
  }

  showLoading();
  await setupResources();
  renderViewer(jsonText);
}

// For some URLs Firefox blocks access to extension assets
// despite having them listed in manifest's web_accessible_resources.
// See https://github.com/paolosimone/virtual-json-viewer/issues/61
async function checkResourcesAccess(): Promise<void> {
  const response = await fetch(CONTENT_CSS_URL);
  if (!response.ok) {
    throw new Error(
      `GET ${CONTENT_CSS_URL} - ${response.status} ${response.statusText}`,
    );
  }
}

const LOADING_ID = "virtual-json-viewer-loading";

function showLoading() {
  if (document.getElementById(LOADING_ID)) return;

  const loading = document.createElement("div");
  loading.id = LOADING_ID;
  loading.setAttribute("role", "status");
  loading.setAttribute("aria-label", "Loading JSON viewer");
  const label = document.createElement("span");
  label.textContent = "Loading JSON viewer...";
  const track = document.createElement("div");
  track.className = "track";
  const bar = document.createElement("div");
  bar.className = "bar";
  track.appendChild(bar);
  loading.append(label, track);
  document.body.appendChild(loading);
}

function hideLoading() {
  document.getElementById(LOADING_ID)?.remove();
}

function handleLoadError(error: unknown) {
  hideLoading();
  console.warn("Virtual Json Viewer activation failed:", error);
}

function addFavicon(href: string) {
  const linkElement = document.createElement("link");
  linkElement.href = href;
  linkElement.rel = "icon";
  document.head.appendChild(linkElement);
}

function updateTitle() {
  const segments = window.location.pathname.split("/");
  // handle potential trailing slash
  const last = segments.pop() || segments.pop();
  if (last) document.title = last;
}

function renderViewer(jsonText: string) {
  const reactRoot = replaceBodyContent();
  reactRoot.render(<ViewerApp jsonText={jsonText} onReady={hideLoading} />);
}

function replaceBodyContent(): Root {
  const div = document.createElement("div");
  div.style.cssText = "height: 100vh";
  const loading = document.getElementById(LOADING_ID);
  document.body.replaceChildren(div, ...(loading ? [loading] : []));
  return createRoot(div);
}

function tryFindJsonText(): string | undefined {
  const candidates = [];

  // textual content
  const preformatted = document.getElementsByTagName("pre");
  if (preformatted.length == 1) {
    candidates.push(preformatted[0].innerText);
  }

  // body
  candidates.push(document.body.innerText);

  return candidates.find(
    (candidate) => !(Json.tryParseLines(candidate) instanceof Error),
  );
}
