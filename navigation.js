const pageFiles = new Set(["index.html", "cv.html", "projets.html", "contact.html"]);
let navigationVersion = 0;
let renderedUrl = new URL(window.location.href);

function isPortfolioPage(url) {
  const fileName = url.pathname.split("/").pop();
  return url.origin === window.location.origin && pageFiles.has(fileName);
}

async function loadStylesheets(nextDocument, destination) {
  const currentLinks = Array.from(
    document.head.querySelectorAll('link[rel="stylesheet"]'),
  );
  const nextLinks = Array.from(
    nextDocument.head.querySelectorAll('link[rel="stylesheet"]'),
  );
  const nextHrefs = nextLinks.map(
    (link) => new URL(link.getAttribute("href"), destination).href,
  );
  const currentHrefs = new Set(currentLinks.map((link) => link.href));

  await Promise.all(
    nextLinks
      .filter(
        (link, index) => !currentHrefs.has(nextHrefs[index]),
      )
      .map(
        (sourceLink) =>
          new Promise((resolve, reject) => {
            const href = new URL(
              sourceLink.getAttribute("href"),
              destination,
            ).href;
            const link = sourceLink.cloneNode(false);
            link.href = href;
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener(
              "error",
              () => reject(new Error(`Unable to load stylesheet: ${href}`)),
              { once: true },
            );
            document.head.append(link);

            if (link.sheet) {
              resolve();
            }
          }),
      ),
  );

  return new Set(nextHrefs);
}

async function navigateTo(destination, { addHistory = true, scrollY = 0 } = {}) {
  const version = ++navigationVersion;

  try {
    const response = await fetch(destination.href, {
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      throw new Error(`Navigation request failed with status ${response.status}`);
    }

    const nextDocument = new DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );

    if (!nextDocument.body || !nextDocument.title) {
      throw new Error("The requested page has no body or title");
    }

    const nextStylesheets = await loadStylesheets(nextDocument, destination);
    if (version !== navigationVersion) {
      return;
    }

    if (addHistory) {
      const currentState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.replaceState(
        { ...currentState, scrollY: window.scrollY },
        "",
        window.location.href,
      );
      window.history.pushState({ scrollY: 0 }, "", destination.href);
    }

    document.title = nextDocument.title;
    document.documentElement.lang = nextDocument.documentElement.lang;
    const nextDescription = nextDocument.head.querySelector(
      'meta[name="description"]',
    );
    if (nextDescription) {
      const currentDescription = document.head.querySelector(
        'meta[name="description"]',
      );
      if (currentDescription) {
        currentDescription.content = nextDescription.content;
      } else {
        document.head.append(nextDescription.cloneNode());
      }
    }
    document.body.className = nextDocument.body.className;
    document.body.innerHTML = nextDocument.body.innerHTML;

    for (const link of document.head.querySelectorAll(
      'link[rel="stylesheet"]',
    )) {
      if (!nextStylesheets.has(link.href)) {
        link.remove();
      }
    }

    renderedUrl = destination;

    if (destination.hash) {
      const target = document.getElementById(destination.hash.slice(1));
      if (target) {
        target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    } else {
      window.scrollTo(0, scrollY);
    }
  } catch (error) {
    if (version !== navigationVersion) {
      return;
    }

    console.error("Client-side navigation failed; using a full page load.", error);
    window.location.assign(destination.href);
  }
}

document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) {
    return;
  }

  const link = event.target.closest("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  if (!isPortfolioPage(destination)) {
    return;
  }

  if (
    destination.pathname === window.location.pathname &&
    destination.search === window.location.search
  ) {
    if (destination.hash) {
      return;
    }

    event.preventDefault();
    if (destination.href !== window.location.href) {
      window.history.pushState({ scrollY: 0 }, "", destination.href);
      renderedUrl = destination;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  event.preventDefault();
  navigateTo(destination);
});

window.addEventListener("popstate", (event) => {
  const destination = new URL(window.location.href);

  if (
    destination.pathname === renderedUrl.pathname &&
    destination.search === renderedUrl.search
  ) {
    renderedUrl = destination;
    return;
  }

  if (isPortfolioPage(destination)) {
    navigateTo(destination, {
      addHistory: false,
      scrollY: event.state?.scrollY ?? 0,
    });
  }
});

window.addEventListener("hashchange", () => {
  renderedUrl = new URL(window.location.href);
});
