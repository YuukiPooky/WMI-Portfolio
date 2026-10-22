const pageStylePattern = /\/CSS\/(?:cv|projets|contact)\.css$/;
let activeUrl = window.location.href;
let navigationInProgress = false;

function showNavigationError(error) {
  console.error("La navigation sans rechargement a échoué.", error);
  const main = document.querySelector("main");
  if (!main) return;

  let message = main.querySelector("[data-navigation-error]");
  if (!message) {
    message = document.createElement("p");
    message.dataset.navigationError = "";
    message.setAttribute("role", "alert");
    main.prepend(message);
  }

  message.textContent =
    "La page demandée n'a pas pu être chargée. Réessaie dans un instant.";
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`Impossible de charger ${href}`));
    document.head.append(link);
  });
}

async function navigateTo(url, addHistoryEntry = true) {
  if (navigationInProgress) return;
  navigationInProgress = true;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`La requête a échoué (${response.status}) : ${url}`);
    }

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, "text/html");
    const nextMain = nextDocument.querySelector("main");
    const nextFooter = nextDocument.querySelector("footer");
    const nextBanner = nextDocument.querySelector(".portfolio-banner");
    const currentMain = document.querySelector("main");
    const currentFooter = document.querySelector("footer");
    const currentBanner = document.querySelector(".portfolio-banner");

    if (!nextMain || !nextFooter || !nextBanner || !currentMain || !currentFooter || !currentBanner) {
      throw new Error(`La page ne contient pas les éléments requis : ${url}`);
    }

    const nextPageStyles = [...nextDocument.querySelectorAll('link[rel="stylesheet"]')]
      .map((link) => new URL(link.href, url))
      .filter((stylesheet) => pageStylePattern.test(stylesheet.pathname));
    const currentPageStyles = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .filter((link) => pageStylePattern.test(new URL(link.href).pathname));
    const stylesToLoad = nextPageStyles.filter(
      (nextStyle) =>
        !currentPageStyles.some(
          (currentStyle) =>
            new URL(currentStyle.href).pathname === nextStyle.pathname,
        ),
    );

    await Promise.all(stylesToLoad.map((stylesheet) => loadStylesheet(stylesheet.href)));

    currentBanner.replaceWith(document.importNode(nextBanner, true));
    currentMain.replaceWith(document.importNode(nextMain, true));
    currentFooter.replaceWith(document.importNode(nextFooter, true));
    currentPageStyles
      .filter(
        (currentStyle) =>
          !nextPageStyles.some(
            (nextStyle) =>
              new URL(currentStyle.href).pathname === nextStyle.pathname,
          ),
      )
      .forEach((style) => style.remove());

    document.title = nextDocument.title;
    if (addHistoryEntry) {
      window.history.pushState({}, "", url);
    }
    activeUrl = url.href;
    window.scrollTo(0, 0);
  } catch (error) {
    if (!addHistoryEntry) {
      window.history.replaceState({}, "", activeUrl);
    }
    showNavigationError(error);
  } finally {
    navigationInProgress = false;
  }
}

document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const link = event.target.closest("a");
  if (
    !link ||
    link.target ||
    link.hasAttribute("download") ||
    link.href.startsWith("mailto:") ||
    link.hash ||
    window.location.protocol === "file:"
  ) {
    return;
  }

  const url = new URL(link.href);
  if (
    url.origin !== window.location.origin ||
    !url.pathname.endsWith(".html") ||
    url.href === window.location.href
  ) {
    return;
  }

  event.preventDefault();
  navigateTo(url);
});

window.addEventListener("popstate", () => {
  navigateTo(new URL(window.location.href), false);
});
