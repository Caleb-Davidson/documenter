var markdown = window.markdownit ? window.markdownit({
  html: true,
  linkify: true,
  typographer: false
}) : null;

(function () {
  var content = document.querySelector(".doc-content");
  if (!content) { return; }

  if (!markdown || !window.DOMPurify) {
    content.innerHTML = "<h2>Documentation</h2><p>Docs renderer failed to load required parser libraries.</p>";
    return;
  }

  var isShell = document.body.dataset.shell === "true";

  (async function () {
    var pageTitle, pageDescription, pageSection, pagePath;

    if (isShell) {
      var route = parseShellHash(location.hash);
      pagePath = route.slug || "index";

      var mdText = await loadMarkdownSource(pagePath + ".md");
      if (!mdText) {
        content.innerHTML = "<h2>Documentation</h2><p>Page not found: " + escapeHtml(pagePath + ".md") + "</p>";
        pageTitle = "Documentation";
        pageDescription = "";
        pageSection = "Documentation";
      } else {
        var parsed = parseMdSource(mdText, true);
        pageTitle = parsed.frontMatter.title || titleFromPath(pagePath + ".md");
        pageDescription = parsed.frontMatter.description || "";
        pageSection = parsed.frontMatter.section || "Documentation";
        content.innerHTML = parsed.html;
      }
    } else {
      var mdSource = document.body.dataset.docSource;
      if (mdSource) {
        var fetchedMd = await loadMarkdownSource(mdSource);
        if (fetchedMd) {
          content.innerHTML = parseMdSource(fetchedMd, false).html;
        }
      }

      pageTitle = document.body.dataset.docTitle || document.title;
      pageDescription = document.body.dataset.docDescription || "";
      pageSection = document.body.dataset.docSection || "Documentation";
      pagePath = normalizePath(location.pathname.split("/").pop() || "index.html");
    }

    document.title = pageTitle + " | Documentation";

    var navState = await resolveNavState(pagePath);
    var sectionLink = getSectionLink(navState.sections, pageSection);

    ensureHeadingIds(content);

    if (isShell) {
      scrollToHashAnchor(parseShellHash(location.hash).anchor);
    }

    var tocItems = collectHeadings(content);

    var shell = document.createElement("div");
    shell.className = "docs-shell";
    shell.innerHTML =
      '<div class="docs-layout">' +
      '<aside class="sidebar">' +
      '<div class="sidebar-inner">' +
      '<p class="sidebar-heading">Documentation</p>' +
      '<button class="sidebar-toggle" type="button" aria-expanded="false" aria-controls="docs-sidebar-nav">' +
      '<span>Documentation</span>' +
      '<span class="sidebar-toggle-icon" aria-hidden="true">' + chevronRightSvg() + "</span>" +
      "</button>" +
      '<nav class="sidebar-nav" id="docs-sidebar-nav" aria-label="Documentation navigation">' +
      renderNav(navState.sections, pagePath) +
      "</nav>" +
      '<div class="sidebar-footer">' +
      '<a class="sidebar-link" href="./index.html">' + homeIconSvg() + "Docs home</a>" +
      "</div>" +
      "</div>" +
      "</aside>" +
      '<main class="article-shell">' +
      '<div class="article-topbar">' +
      '<nav class="breadcrumbs" aria-label="Breadcrumb">' +
      '<a href="./index.html">Overview</a>' +
      '<span class="breadcrumb-separator" aria-hidden="true">' + chevronRightSvg() + "</span>" +
      '<a href="' + sectionLink + '">' + escapeHtml(pageSection) + "</a>" +
      '<span class="breadcrumb-separator" aria-hidden="true">' + chevronRightSvg() + "</span>" +
      '<span class="breadcrumb-current">' + escapeHtml(pageTitle) + "</span>" +
      "</nav>" +
      "</div>" +
      '<article class="article-card">' +
      '<section class="page-intro">' +
      "<h1>" + escapeHtml(pageTitle) + "</h1>" +
      (pageDescription ? '<p class="lede">' + escapeHtml(pageDescription) + "</p>" : "") +
      "</section>" +
      "</article>" +
      "</main>" +
      '<aside class="toc">' +
      '<div class="toc-card">' +
      '<p class="toc-heading">On This Page</p>' +
      renderToc(tocItems, pagePath, isShell) +
      "</div>" +
      "</aside>" +
      "</div>";

    var articleCard = shell.querySelector(".article-card");
    articleCard.appendChild(content);

    document.body.innerHTML = "";
    document.body.appendChild(shell);
    setupResponsiveSidebar(shell);
    markCurrentNavLink(pagePath);
    renderMermaidDiagrams(content);

    if (isShell) {
      window.addEventListener("hashchange", function () {
        var nextRoute = parseShellHash(location.hash);
        if (nextRoute.slug === pagePath) {
          scrollToHashAnchor(nextRoute.anchor);
          return;
        }
        location.reload();
      });
    }
  })();
})();

function renderNav(sections, pagePath) {
  if (!sections.length) {
    return '<div class="empty-state">No documentation pages found.</div>';
  }

  return sections
    .map(function (section) {
      var docs = (section.docs || [])
        .map(function (doc) {
          var docPath = normalizePath(doc.path);
          var activeClass = normalizePageKey(docPath) === normalizePageKey(pagePath) ? "is-active" : "";
          return '<li><a class="' + activeClass + '" href="' + doc.path + '">' + escapeHtml(doc.title) + "</a></li>";
        })
        .join("");

      return (
        '<section class="doc-section">' +
        '<h2 class="doc-section-heading">' + escapeHtml(section.title) + "</h2>" +
        '<ul class="doc-nav">' + docs + "</ul>" +
        "</section>"
      );
    })
    .join("");
}

function renderToc(items, pagePath, isShell) {
  if (!items.length) {
    return '<div class="empty-state">No section headings detected on this page.</div>';
  }

  var links = items
    .map(function (item) {
      var href = isShell
        ? buildShellHash(pagePath, item.id)
        : "#" + item.id;
      return '<li><a class="toc-depth-' + item.level + '" href="' + href + '">' + escapeHtml(item.label) + "</a></li>";
    })
    .join("");

  return '<ul class="toc-list">' + links + "</ul>";
}

function ensureHeadingIds(root) {
  var seen = new Set();

  root.querySelectorAll("h2, h3").forEach(function (heading) {
    var baseId = heading.id || slugify(heading.textContent || "section");
    var id = baseId;
    var suffix = 2;

    while (seen.has(id)) {
      id = baseId + "-" + suffix;
      suffix++;
    }

    heading.id = id;
    seen.add(id);
  });
}

function collectHeadings(root) {
  return Array.from(root.querySelectorAll("h2, h3")).map(function (heading) {
    return {
      id: heading.id,
      label: heading.textContent || "",
      level: Number(heading.tagName.slice(1))
    };
  });
}

function normalizePath(path) {
  return String(path).replace(/^\.\//, "");
}

function normalizePageKey(value) {
  var normalized = normalizePath(value || "").replace(/^#/, "");
  var route = parseShellHash("#" + normalized);
  return route.slug || normalized;
}

async function resolveNavState(pagePath) {
  var discoveredDocs = await discoverDocs();
  return {
    sections: groupDocsBySection(discoveredDocs)
  };
}

async function discoverDocs() {
  var isShell = document.body.dataset.shell === "true";
  if (!isShell) {
    return discoverFromDirectoryListing();
  }
  return discoverFromIndexMd();
}

async function discoverFromDirectoryListing() {
  try {
    var response = await fetch("./", { cache: "no-store" });
    if (!response.ok) { return []; }

    var html = await response.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var links = Array.from(doc.querySelectorAll("a"));

    var seen = new Set();
    var paths = [];
    links.forEach(function (link) {
      var href = normalizeDiscoveredHref(link.getAttribute("href") || "");
      if (!href || href.startsWith("http") || href.startsWith("#")) { return; }
      if (!href.endsWith(".html") && !href.endsWith(".htm")) { return; }
      if (seen.has(href)) { return; }
      seen.add(href);
      paths.push(href);
    });

    var docs = await Promise.all(paths.map(readDocMetadata));
    return docs.filter(Boolean);
  } catch (_error) {
    return [];
  }
}

async function discoverFromIndexMd() {
  try {
    var response = await fetch("index.md", { cache: "no-store" });
    if (!response.ok) { return []; }

    var text = await response.text();
    var mdLinkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    var seen = new Set();
    var paths = [];
    var match;

    while ((match = mdLinkPattern.exec(text)) !== null) {
      var href = normalizeDiscoveredHref(match[2]);
      if (!href || href === "index.md" || href.startsWith("http")) { continue; }
      if (seen.has(href)) { continue; }
      seen.add(href);
      paths.push(href);
    }

    var docs = await Promise.all(paths.map(readDocMetadata));
    return docs.filter(Boolean);
  } catch (_error) {
    return [];
  }
}

async function readDocMetadata(path) {
  try {
    var response = await fetch("./" + path, { cache: "no-store" });
    if (!response.ok) { return null; }

    if (path.endsWith(".md")) {
      var text = await response.text();
      var parsed = parseMdSource(text, false);
      var slug = path.replace(/\.md$/, "");
      return {
        path: "#" + slug,
        title: parsed.frontMatter.title || titleFromPath(path),
        section: parsed.frontMatter.section || "Documentation",
        description: parsed.frontMatter.description || ""
      };
    }

    var html = await response.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var body = doc.body;
    var title = (body && body.dataset.docTitle) || doc.title || titleFromPath(path);
    var section = (body && body.dataset.docSection) || "Documentation";
    var description = (body && body.dataset.docDescription) || "";

    return {
      path: "./" + path,
      title: title,
      section: section,
      description: description
    };
  } catch (_error) {
    return null;
  }
}

function groupDocsBySection(docs) {
  var sectionMap = new Map();

  docs.forEach(function (doc) {
    var sectionTitle = doc.section || "Documentation";
    if (!sectionMap.has(sectionTitle)) {
      sectionMap.set(sectionTitle, []);
    }
    sectionMap.get(sectionTitle).push(doc);
  });

  return Array.from(sectionMap.entries()).sort(function (a, b) {
    if (a[0] < b[0]) { return -1; }
    if (a[0] > b[0]) { return 1; }
    return 0;
  }).map(function (entry) {
    return {
      title: entry[0],
      docs: entry[1].sort(function (left, right) {
        if (left.title < right.title) { return -1; }
        if (left.title > right.title) { return 1; }
        return 0;
      })
    };
  });
}

function getSectionLink(sections, pageSection) {
  var section = sections.find(function (item) { return item.title === pageSection; });
  return (section && section.docs && section.docs[0] && section.docs[0].path) || "./index.html";
}

function normalizeDiscoveredHref(href) {
  return String(href)
    .replace(/^\.\//, "")
    .replace(/^\//, "")
    .split("?")[0]
    .split("#")[0];
}

function titleFromPath(path) {
  return String(path)
    .replace(/\.html?$|\.md$/i, "")
    .split("-")
    .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
    .join(" ");
}

function markCurrentNavLink(pagePath) {
  document.querySelectorAll(".doc-nav a").forEach(function (link) {
    var href = normalizePageKey(link.getAttribute("href") || "");
    if (href === normalizePageKey(pagePath)) {
      link.classList.add("is-active");
    }
  });
}

function slugify(value) {
  value = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "section";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setupResponsiveSidebar(root) {
  var toggle = root.querySelector(".sidebar-toggle");
  var nav = root.querySelector(".sidebar-nav");
  var footer = root.querySelector(".sidebar-footer");

  if (!toggle || !nav) { return; }

  var mediaQuery = window.matchMedia("(max-width: 920px)");

  function applySidebarState(isMobile) {
    var expanded = !isMobile;
    toggle.hidden = !isMobile;
    toggle.setAttribute("aria-expanded", String(expanded));
    nav.hidden = !expanded;
    if (footer) {
      footer.hidden = !expanded && isMobile;
    }
  }

  toggle.addEventListener("click", function () {
    var expanded = toggle.getAttribute("aria-expanded") === "true";
    var nextExpanded = !expanded;
    toggle.setAttribute("aria-expanded", String(nextExpanded));
    nav.hidden = !nextExpanded;
    if (footer) {
      footer.hidden = !nextExpanded;
    }
  });

  applySidebarState(mediaQuery.matches);
  mediaQuery.addEventListener("change", function (event) {
    applySidebarState(event.matches);
  });
}

function homeIconSvg() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.75 12 4l8 6.75V20H4v-9.25Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.25 20v-5.5h5.5V20" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
}

function chevronRightSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

async function loadMarkdownSource(sourcePath) {
  try {
    var response = await fetch(sourcePath, { cache: "no-store" });
    if (!response.ok) { return null; }
    return await response.text();
  } catch (_error) {
    return null;
  }
}

function parseMdSource(mdText, inShell) {
  var parsed = parseFrontMatterYaml(mdText);

  if (parsed.error) {
    return {
      frontMatter: {},
      content: "",
      html: '<div class="empty-state"><strong>Invalid frontmatter:</strong> ' + escapeHtml(parsed.error) + "</div>"
    };
  }

  var unsafeHtml = markdown ? markdown.render(parsed.content || "") : "";
  var safeHtml = window.DOMPurify ? window.DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true }
  }) : unsafeHtml;

  var parser = new DOMParser();
  var doc = parser.parseFromString(safeHtml, "text/html");
  var firstChild = doc.body.firstElementChild;
  if (firstChild && firstChild.tagName === "H1") {
    firstChild.remove();
  }

  if (inShell) {
    doc.querySelectorAll("a[href]").forEach(function (anchor) {
      var href = anchor.getAttribute("href") || "";
      if (!/\.md(?=[#?]|$)/i.test(href)) { return; }
      var normalizedHref = href.replace(/^\.\//, "");
      var mdIndex = normalizedHref.toLowerCase().indexOf(".md");
      if (mdIndex < 0) { return; }
      var slug = normalizedHref.slice(0, mdIndex);
      var suffix = normalizedHref.slice(mdIndex + 3);
      var sectionId = "";
      if (suffix && suffix.charAt(0) === "#") {
        sectionId = suffix.slice(1);
      }
      anchor.setAttribute("href", buildShellHash(slug, sectionId));
    });
  }

  return {
    frontMatter: parsed.data || {},
    content: parsed.content || "",
    html: doc.body.innerHTML
  };
}

function renderMermaidDiagrams(root) {
  if (!root || !window.mermaid) { return; }

  // markdown-it renders ```mermaid fences as <pre><code class="language-mermaid">.
  // Mermaid renders elements carrying the "mermaid" class, so re-host the source
  // text into <pre class="mermaid"> nodes before invoking the renderer.
  var sources = Array.from(root.querySelectorAll("code.language-mermaid"));
  if (!sources.length) { return; }

  var hosts = sources.map(function (code) {
    var pre = code.parentElement;
    var target = (pre && pre.tagName === "PRE") ? pre : code;
    var host = document.createElement("pre");
    host.className = "mermaid";
    var source = code.textContent || "";
    host.textContent = source;
    // Preserve the source so diagrams can be re-rendered when the OS theme flips.
    host.dataset.mermaidSource = source;
    target.replaceWith(host);
    return host;
  });

  runMermaid(hosts);

  // The shell themes itself from prefers-color-scheme via CSS variables; keep the
  // diagrams in sync by re-rendering them with the matching mermaid theme.
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (darkQuery.addEventListener) {
    darkQuery.addEventListener("change", function () {
      hosts.forEach(function (host) {
        host.removeAttribute("data-processed");
        host.innerHTML = "";
        host.textContent = host.dataset.mermaidSource || "";
      });
      runMermaid(hosts);
    });
  }
}

// Shared diagram palette, sourced from the docs-shell CSS tokens in style.css so
// mermaid diagrams and referenced SVGs (see templates/diagram-template.svg) read
// as one system. Keep these values in sync with that template's <style> block.
var DIAGRAM_FONT = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function diagramPalette(dark) {
  return dark
    ? { node: "#303b43", border: "#5d6f7d", text: "#eeeeee", line: "#31c4ca", soft: "#37444d", bg: "#252d34" }
    : { node: "#ffffff", border: "#d8ddea", text: "#1f2937", line: "#2563eb", soft: "#f8faff", bg: "#f7f8fc" };
}

function mermaidThemeVariables(p) {
  return {
    fontFamily: DIAGRAM_FONT,
    background: p.bg,
    // Flowchart nodes/edges
    mainBkg: p.node,
    primaryColor: p.node,
    primaryBorderColor: p.border,
    primaryTextColor: p.text,
    nodeBorder: p.border,
    lineColor: p.line,
    textColor: p.text,
    secondaryColor: p.soft,
    tertiaryColor: p.soft,
    tertiaryBorderColor: p.border,
    edgeLabelBackground: p.bg,
    clusterBkg: p.soft,
    clusterBorder: p.border,
    // Sequence diagrams
    actorBkg: p.node,
    actorBorder: p.border,
    actorTextColor: p.text,
    signalColor: p.line,
    signalTextColor: p.text,
    labelBoxBkgColor: p.node,
    labelBoxBorderColor: p.border,
    labelTextColor: p.text,
    noteBkgColor: p.soft,
    noteBorderColor: p.border,
    noteTextColor: p.text
  };
}

function runMermaid(hosts) {
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  try {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: mermaidThemeVariables(diagramPalette(prefersDark))
    });
    var result = window.mermaid.run({ nodes: hosts });
    if (result && typeof result.then === "function") {
      result.then(function () { roundMermaidNodes(hosts); }, function () { /* per-diagram errors render inline */ });
    }
  } catch (_error) {
    // Renderer unavailable or threw synchronously: leave the source text visible.
  }
}

// Mermaid draws [square] flowchart nodes with no corner radius; nudge them to the
// same subtle rounding used by the referenced-SVG template so the two match.
function roundMermaidNodes(hosts) {
  hosts.forEach(function (host) {
    host.querySelectorAll(".node rect").forEach(function (rect) {
      rect.setAttribute("rx", "4");
      rect.setAttribute("ry", "4");
    });
  });
}

function parseFrontMatterYaml(mdText) {
  var match = String(mdText).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: mdText, error: null };
  }

  try {
    var yaml = window.jsyaml ? window.jsyaml.load(match[1]) : {};
    return {
      data: yaml && typeof yaml === "object" ? yaml : {},
      content: match[2],
      error: null
    };
  } catch (error) {
    var message = error && error.message ? error.message : "Unable to parse YAML frontmatter.";
    return { data: {}, content: "", error: message };
  }
}

function parseShellHash(hash) {
  var raw = String(hash || "").replace(/^#/, "");
  if (!raw) {
    return { slug: "index", anchor: "" };
  }

  var parts = raw.split("~");
  return {
    slug: parts[0] || "index",
    anchor: parts[1] || ""
  };
}

function buildShellHash(slug, anchor) {
  var safeSlug = String(slug || "index").replace(/^#/, "");
  var safeAnchor = String(anchor || "").replace(/^#/, "");
  if (!safeAnchor) {
    return "#" + safeSlug;
  }
  return "#" + safeSlug + "~" + safeAnchor;
}

function scrollToHashAnchor(anchorId) {
  if (!anchorId) { return; }
  var target = document.getElementById(anchorId);
  if (!target) { return; }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}
