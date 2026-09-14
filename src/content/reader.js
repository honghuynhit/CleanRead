/* CleanRead — content script.
 * Được background inject theo yêu cầu (activeTab), không chạy nền trên mọi trang.
 * Toàn bộ giao diện nằm trong shadow DOM nên trang gốc không bị đụng tới:
 * tắt chế độ đọc là trang trở về nguyên trạng, kể cả vị trí cuộn. */

(function () {
  "use strict";

  if (window.__CleanRead__) {
    window.__CleanRead__.toggle();
    return;
  }

  var HOST_ID = "cleanread-host";
  var PRINT_STYLE_ID = "cleanread-print-style";
  var WORDS_PER_MINUTE = 200;
  /* Readability đôi khi vẫn trả về khối <body> của trang danh mục. Dưới ngưỡng
   * này thì coi như trang không có bài viết, thay vì bày ra một mớ tiêu đề. */
  var MIN_CHARS = 300;

  var DROP_TAGS = [
    "script", "style", "link", "meta", "base", "noscript", "iframe", "object",
    "embed", "applet", "form", "input", "select", "textarea", "button", "canvas",
    "svg", "math", "template", "slot", "audio", "source", "track",
  ];

  var KEEP_TAGS = [
    "a", "abbr", "article", "b", "blockquote", "br", "caption", "cite", "code",
    "col", "colgroup", "dd", "del", "div", "dl", "dt", "em", "figcaption",
    "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins",
    "kbd", "li", "mark", "ol", "p", "picture", "pre", "q", "s", "samp",
    "section", "small", "span", "strong", "sub", "sup", "table", "tbody", "td",
    "tfoot", "th", "thead", "time", "tr", "u", "ul", "video", "wbr",
  ];

  var KEEP_ATTRS = [
    "href", "src", "srcset", "sizes", "alt", "title", "width", "height",
    "colspan", "rowspan", "datetime", "lang", "dir", "cite", "poster", "controls",
  ];

  var dropSet = toSet(DROP_TAGS);
  var keepSet = toSet(KEEP_TAGS);
  var attrSet = toSet(KEEP_ATTRS);

  var state = {
    active: false,
    host: null,
    root: null, // .cr-root trong shadow
    scroller: null,
    progress: null,
    panel: null,
    toast: null,
    settings: null,
    article: null,
    pageScroll: 0,
    prevOverflow: "",
    prevScrollBehavior: "",
    toastTimer: 0,
  };

  /* ------------------------------------------------------------------ */
  /* Trích nội dung                                                       */
  /* ------------------------------------------------------------------ */

  function extract() {
    if (typeof Readability !== "function") return null;

    var clone;
    try {
      clone = document.cloneNode(true);
    } catch (e) {
      return null;
    }

    // Bảo đảm link/ảnh tương đối được đổi thành tuyệt đối đúng gốc.
    try {
      var head = clone.head || clone.querySelector("head");
      if (head && !clone.querySelector("base[href]")) {
        var base = clone.createElement("base");
        base.setAttribute("href", document.baseURI || location.href);
        head.insertBefore(base, head.firstChild);
      }
    } catch (e) {
      /* không sao, Readability vẫn xử lý được phần lớn trường hợp */
    }

    unwrapLazyImages(clone);

    var parsed = null;
    try {
      parsed = new Readability(clone, { charThreshold: 250, keepClasses: false }).parse();
    } catch (e) {
      parsed = null;
    }
    if (!parsed || !parsed.content) return null;

    var holder = document.createElement("div");
    holder.innerHTML = parsed.content;
    sanitize(holder);
    var plain = holder.textContent.replace(/\s+/g, " ").trim();
    if (plain.length < MIN_CHARS) return null;

    return {
      title: parsed.title || document.title || "Không có tiêu đề",
      byline: (parsed.byline || "").trim(),
      siteName: parsed.siteName || location.hostname.replace(/^www\./, ""),
      publishedTime: parsed.publishedTime || "",
      text: parsed.textContent || holder.textContent,
      node: holder,
    };
  }

  /* Nhiều trang chỉ đặt ảnh thật ở data-src và chờ JS lazy-load; ở bản sao
   * tĩnh thì JS đó không chạy nên phải tự chuyển sang src. */
  function unwrapLazyImages(doc) {
    var imgs;
    try {
      imgs = doc.querySelectorAll("img");
    } catch (e) {
      return;
    }
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = img.getAttribute("src") || "";
      if (!src || /^data:image\/(gif|svg)/i.test(src)) {
        var real =
          img.getAttribute("data-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("data-lazy-src") ||
          img.getAttribute("data-echo") ||
          "";
        if (real) img.setAttribute("src", real);
      }
      var srcset = img.getAttribute("srcset");
      var lazySet = img.getAttribute("data-srcset") || img.getAttribute("data-lazy-srcset");
      if (!srcset && lazySet) img.setAttribute("srcset", lazySet);
      img.removeAttribute("loading");
    }
  }

  /* Readability trả về HTML, không phải HTML đã được làm sạch về mặt an toàn.
   * Ta bỏ hẳn thẻ thực thi, gỡ vỏ thẻ lạ, và chỉ giữ thuộc tính cần cho việc đọc. */
  function sanitize(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    var remove = [];
    var unwrap = [];
    var el;

    while ((el = walker.nextNode())) {
      var tag = el.tagName.toLowerCase();
      if (dropSet[tag]) {
        remove.push(el);
        continue;
      }
      if (!keepSet[tag]) {
        unwrap.push(el);
      }
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var attr = el.attributes[i];
        var name = attr.name.toLowerCase();
        if (!attrSet[name] || isUnsafeUrlAttr(name, attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
      if (tag === "a" && el.getAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      if (tag === "img" || tag === "video") {
        el.removeAttribute("width");
        el.removeAttribute("height");
      }
    }

    remove.forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    unwrap.forEach(function (node) {
      if (!node.parentNode) return;
      while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
      node.parentNode.removeChild(node);
    });
  }

  function isUnsafeUrlAttr(name, value) {
    if (name !== "href" && name !== "src" && name !== "srcset" && name !== "poster") return false;
    return /^\s*(javascript|vbscript|data:text\/html)/i.test(value || "");
  }

  /* ------------------------------------------------------------------ */
  /* Dựng giao diện                                                       */
  /* ------------------------------------------------------------------ */

  function icon(paths) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + "</svg>";
  }

  var ICONS = {
    close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
    print: icon('<path d="M7 9V4h10v5"/><path d="M5 9h14v7h-3v4H8v-4H5z"/>'),
    copy: icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h9"/>'),
  };

  function build(article, settings) {
    var host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-cleanread", "");
    var hostStyle = {
      position: "fixed",
      inset: "0",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      margin: "0",
      padding: "0",
      border: "0",
      display: "block",
      zIndex: "2147483647",
      colorScheme: "normal",
    };
    Object.keys(hostStyle).forEach(function (key) {
      host.style.setProperty(hyphenate(key), hostStyle[key], "important");
    });

    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CLEANREAD_CSS;
    shadow.appendChild(style);

    var root = document.createElement("div");
    root.className = "cr-root";
    root.style.setProperty(
      "--cr-ui-font",
      'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif'
    );
    shadow.appendChild(root);

    var minutes = Math.max(1, Math.round(countWords(article.text) / WORDS_PER_MINUTE));

    root.appendChild(buildBar(article, minutes));
    root.appendChild(buildPanel(settings));

    var scroller = document.createElement("main");
    scroller.className = "cr-scroll";
    scroller.tabIndex = -1;

    var art = document.createElement("article");
    art.className = "cr-article";

    var head = document.createElement("header");
    head.className = "cr-head";

    var h1 = document.createElement("h1");
    h1.className = "cr-title";
    h1.textContent = article.title;
    head.appendChild(h1);

    var meta = document.createElement("div");
    meta.className = "cr-meta";
    metaItem(meta, article.byline);
    metaItem(meta, formatDate(article.publishedTime));
    metaItem(meta, minutes + " phút đọc");
    if (meta.childNodes.length) head.appendChild(meta);

    art.appendChild(head);

    var body = document.createElement("div");
    body.className = "cr-body";
    while (article.node.firstChild) body.appendChild(article.node.firstChild);
    art.appendChild(body);

    scroller.appendChild(art);
    root.appendChild(scroller);

    var toast = document.createElement("div");
    toast.className = "cr-toast";
    toast.setAttribute("role", "status");
    root.appendChild(toast);

    state.host = host;
    state.root = root;
    state.scroller = scroller;
    state.progress = root.querySelector(".cr-progress");
    state.panel = root.querySelector(".cr-panel");
    state.toast = toast;

    return host;
  }

  function buildBar(article, minutes) {
    var bar = document.createElement("header");
    bar.className = "cr-bar";

    var source = document.createElement("div");
    source.className = "cr-source";
    var name = document.createElement("b");
    name.textContent = article.siteName;
    var time = document.createElement("span");
    time.textContent = minutes + " phút đọc";
    source.appendChild(name);
    source.appendChild(time);
    bar.appendChild(source);

    var actions = document.createElement("div");
    actions.className = "cr-actions";

    actions.appendChild(
      button("cr-btn cr-btn-type", "Aa", "Tuỳ chỉnh cách hiển thị", function (btn) {
        togglePanel(btn);
      }, { expands: true })
    );
    actions.appendChild(
      button("cr-btn", ICONS.copy, "Sao chép nội dung bài viết", copyArticle)
    );
    actions.appendChild(
      button("cr-btn", ICONS.print, "In bài viết", function () {
        closePanel();
        window.print();
      })
    );
    actions.appendChild(
      button("cr-btn", ICONS.close, "Thoát chế độ đọc (Esc)", deactivate)
    );

    bar.appendChild(actions);

    var progress = document.createElement("div");
    progress.className = "cr-progress";
    bar.appendChild(progress);

    return bar;
  }

  function button(className, html, label, onClick, opts) {
    var btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    btn.innerHTML = html;
    btn.title = label;
    btn.setAttribute("aria-label", label);
    if (opts && opts.expands) btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      onClick(btn);
    });
    return btn;
  }

  function buildPanel(settings) {
    var panel = document.createElement("div");
    panel.className = "cr-panel";
    panel.setAttribute("data-open", "false");

    panel.appendChild(
      segment("Nền", Object.keys(CLEANREAD_THEMES).map(function (key) {
        return { value: key, label: CLEANREAD_THEMES[key].label };
      }), settings.theme, function (value) {
        update({ theme: value });
      })
    );

    panel.appendChild(
      segment("Kiểu chữ", [
        { value: "serif", label: "Có chân", className: "cr-chip-serif" },
        { value: "sans", label: "Không chân" },
      ], settings.font, function (value) {
        update({ font: value });
      })
    );

    panel.appendChild(
      slider("Cỡ chữ", CLEANREAD_LIMITS.fontSize, settings.fontSize, function (value) {
        update({ fontSize: value });
      })
    );

    panel.appendChild(
      slider("Giãn dòng", CLEANREAD_LIMITS.lineHeight, settings.lineHeight, function (value) {
        update({ lineHeight: value });
      })
    );

    panel.appendChild(
      slider("Bề ngang", CLEANREAD_LIMITS.measure, settings.measure, function (value) {
        update({ measure: value });
      })
    );

    var row = document.createElement("div");
    row.className = "cr-row";
    var label = document.createElement("label");
    label.className = "cr-check";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = settings.images;
    box.setAttribute("data-cr", "images");
    box.addEventListener("change", function () {
      update({ images: box.checked });
    });
    label.appendChild(box);
    label.appendChild(document.createTextNode("Hiện ảnh trong bài"));
    row.appendChild(label);
    panel.appendChild(row);

    return panel;
  }

  function segment(labelText, options, current, onPick) {
    var row = document.createElement("div");
    row.className = "cr-row";
    var label = document.createElement("span");
    label.textContent = labelText;
    row.appendChild(label);

    var seg = document.createElement("div");
    seg.className = "cr-seg";
    options.forEach(function (option) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cr-chip" + (option.className ? " " + option.className : "");
      chip.textContent = option.label;
      chip.setAttribute("data-value", option.value);
      chip.setAttribute("aria-pressed", String(option.value === current));
      chip.addEventListener("click", function () {
        onPick(option.value);
      });
      seg.appendChild(chip);
    });
    row.appendChild(seg);
    return row;
  }

  function slider(labelText, limit, current, onInput) {
    var row = document.createElement("div");
    row.className = "cr-row";
    var label = document.createElement("span");
    label.textContent = labelText;
    row.appendChild(label);

    var input = document.createElement("input");
    input.type = "range";
    input.className = "cr-range";
    input.min = String(limit.min);
    input.max = String(limit.max);
    input.step = String(limit.step);
    input.value = String(current);
    input.setAttribute("aria-label", labelText);
    input.addEventListener("input", function () {
      onInput(Number(input.value));
    });
    row.appendChild(input);
    return row;
  }

  /* ------------------------------------------------------------------ */
  /* Bật / tắt                                                            */
  /* ------------------------------------------------------------------ */

  function activate() {
    if (state.active) return;

    cleanreadLoad(function (settings) {
      if (state.active) return;
      state.settings = settings;

      var article = extract();
      state.pageScroll = window.scrollY || document.documentElement.scrollTop || 0;

      var host = article ? build(article, settings) : buildEmpty(settings);
      state.article = article;

      document.documentElement.appendChild(host);
      addPrintStyle();

      state.prevOverflow = document.documentElement.style.overflow;
      state.prevScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.setProperty("overflow", "hidden", "important");
      document.documentElement.style.setProperty("scroll-behavior", "auto");

      applySettings(state.settings);
      state.active = true;

      if (state.scroller) {
        state.scroller.addEventListener("scroll", onScroll, { passive: true });
        state.scroller.focus({ preventScroll: true });
      }
      document.addEventListener("keydown", onKeyDown, true);
      state.root.addEventListener("click", onRootClick, true);

      report(true);
    });
  }

  function buildEmpty(settings) {
    var article = {
      title: document.title || location.hostname,
      byline: "",
      siteName: location.hostname.replace(/^www\./, ""),
      publishedTime: "",
      text: "",
      node: document.createElement("div"),
    };
    var host = build(article, settings);
    var art = state.root.querySelector(".cr-article");
    art.innerHTML = "";
    var box = document.createElement("div");
    box.className = "cr-empty";
    var h2 = document.createElement("h2");
    h2.textContent = "Trang này không có bài viết để đọc";
    var p = document.createElement("p");
    p.textContent =
      "CleanRead không tìm thấy khối nội dung đủ dài — thường gặp ở trang chủ, trang danh mục hoặc ứng dụng web. Hãy mở một bài viết cụ thể rồi bật lại.";
    box.appendChild(h2);
    box.appendChild(p);
    art.appendChild(box);
    return host;
  }

  function deactivate() {
    if (!state.active) return;

    document.removeEventListener("keydown", onKeyDown, true);
    if (state.scroller) state.scroller.removeEventListener("scroll", onScroll);
    if (state.host && state.host.parentNode) state.host.parentNode.removeChild(state.host);
    removePrintStyle();

    document.documentElement.style.overflow = state.prevOverflow;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, state.pageScroll);
    document.documentElement.style.scrollBehavior = state.prevScrollBehavior;

    state.active = false;
    state.host = null;
    state.root = null;
    state.scroller = null;
    state.panel = null;
    state.progress = null;
    state.toast = null;
    state.article = null;

    report(false);
  }

  function toggle() {
    if (state.active) deactivate();
    else activate();
  }

  /* ------------------------------------------------------------------ */
  /* Cấu hình                                                             */
  /* ------------------------------------------------------------------ */

  function update(patch) {
    state.settings = cleanreadNormalize(Object.assign({}, state.settings, patch));
    applySettings(state.settings);
    cleanreadSave(patch);
  }

  function applySettings(settings) {
    if (!state.root) return;
    cleanreadApplyVars(state.root, settings);
    state.root.setAttribute("data-theme", settings.theme);
    state.root.setAttribute("data-images", settings.images ? "on" : "off");
    syncPanel(settings);
  }

  function syncPanel(settings) {
    if (!state.panel) return;
    var chips = state.panel.querySelectorAll(".cr-chip");
    for (var i = 0; i < chips.length; i++) {
      var value = chips[i].getAttribute("data-value");
      var isTheme = !!CLEANREAD_THEMES[value];
      var pressed = isTheme ? value === settings.theme : value === settings.font;
      chips[i].setAttribute("aria-pressed", String(pressed));
    }
    var ranges = state.panel.querySelectorAll(".cr-range");
    if (ranges[0]) ranges[0].value = String(settings.fontSize);
    if (ranges[1]) ranges[1].value = String(settings.lineHeight);
    if (ranges[2]) ranges[2].value = String(settings.measure);
    var box = state.panel.querySelector('input[data-cr="images"]');
    if (box) box.checked = settings.images;
  }

  /* ------------------------------------------------------------------ */
  /* Tương tác                                                            */
  /* ------------------------------------------------------------------ */

  function togglePanel(btn) {
    if (!state.panel) return;
    var open = state.panel.getAttribute("data-open") === "true";
    state.panel.setAttribute("data-open", String(!open));
    btn.setAttribute("aria-expanded", String(!open));
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel.setAttribute("data-open", "false");
    var btn = state.root.querySelector(".cr-btn-type");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function onRootClick(event) {
    if (!state.panel || state.panel.getAttribute("data-open") !== "true") return;
    var path = event.composedPath ? event.composedPath() : [];
    if (path.indexOf(state.panel) !== -1) return;
    for (var i = 0; i < path.length; i++) {
      if (path[i].classList && path[i].classList.contains("cr-btn-type")) return;
    }
    closePanel();
  }

  function onScroll() {
    if (!state.progress || !state.scroller) return;
    var max = state.scroller.scrollHeight - state.scroller.clientHeight;
    var ratio = max > 0 ? state.scroller.scrollTop / max : 0;
    state.progress.style.width = Math.min(100, Math.max(0, ratio * 100)) + "%";
  }

  function onKeyDown(event) {
    if (!state.active) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (state.panel && state.panel.getAttribute("data-open") === "true") closePanel();
      else deactivate();
      return;
    }

    var target = event.composedPath ? event.composedPath()[0] : event.target;
    if (target && target.tagName === "INPUT") return;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      update({ fontSize: state.settings.fontSize + 1 });
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      update({ fontSize: state.settings.fontSize - 1 });
    } else if (event.key === "t" || event.key === "T") {
      event.preventDefault();
      var keys = Object.keys(CLEANREAD_THEMES);
      var next = keys[(keys.indexOf(state.settings.theme) + 1) % keys.length];
      update({ theme: next });
    }
  }

  function copyArticle() {
    var text = state.root ? plainText() : "";
    if (!text) {
      showToast("Không có nội dung để sao chép");
      return;
    }
    var done = function () {
      showToast("Đã sao chép nội dung bài viết");
    };
    var fail = function () {
      showToast("Trình duyệt chặn thao tác sao chép");
    };
    try {
      navigator.clipboard.writeText(text).then(done, function () {
        if (legacyCopy(text)) done();
        else fail();
      });
    } catch (e) {
      if (legacyCopy(text)) done();
      else fail();
    }
  }

  function plainText() {
    var title = state.root.querySelector(".cr-title");
    var body = state.root.querySelector(".cr-body");
    var parts = [];
    if (title) parts.push(title.textContent.trim());
    parts.push(location.href);
    if (body) parts.push(body.innerText ? body.innerText.trim() : body.textContent.trim());
    return parts.filter(Boolean).join("\n\n");
  }

  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function showToast(message) {
    if (!state.toast) return;
    state.toast.textContent = message;
    state.toast.setAttribute("data-show", "true");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      if (state.toast) state.toast.setAttribute("data-show", "false");
    }, 2200);
  }

  /* ------------------------------------------------------------------ */
  /* Tiện ích                                                             */
  /* ------------------------------------------------------------------ */

  function addPrintStyle() {
    if (document.getElementById(PRINT_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent =
      "@media print{html,body{overflow:visible!important;height:auto!important}" +
      "body>*{display:none!important}" +
      "#" + HOST_ID + "{position:static!important;height:auto!important}}";
    (document.head || document.documentElement).appendChild(style);
  }

  function removePrintStyle() {
    var style = document.getElementById(PRINT_STYLE_ID);
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }

  function metaItem(parent, text) {
    if (!text) return;
    var span = document.createElement("span");
    span.textContent = text;
    parent.appendChild(span);
  }

  function countWords(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    try {
      return date.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) {
      return date.toDateString();
    }
  }

  function hyphenate(name) {
    return name.replace(/[A-Z]/g, function (c) {
      return "-" + c.toLowerCase();
    });
  }

  function toSet(list) {
    var map = Object.create(null);
    list.forEach(function (item) {
      map[item] = true;
    });
    return map;
  }

  function report(active) {
    try {
      chrome.runtime.sendMessage({ type: "CLEANREAD_STATE", active: active }, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) {
      /* service worker có thể đang ngủ — không ảnh hưởng việc đọc */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Kết nối với background / popup                                       */
  /* ------------------------------------------------------------------ */

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "CLEANREAD_PING") {
      sendResponse({ active: state.active });
      return;
    }
    if (message.type === "CLEANREAD_TOGGLE") {
      toggle();
      sendResponse({ active: state.active });
      return;
    }
    if (message.type === "CLEANREAD_CLOSE") {
      deactivate();
      sendResponse({ active: false });
    }
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "sync" || !state.active) return;
    var patch = {};
    var touched = false;
    Object.keys(changes).forEach(function (key) {
      if (key in CLEANREAD_DEFAULTS) {
        patch[key] = changes[key].newValue;
        touched = true;
      }
    });
    if (!touched) return;
    state.settings = cleanreadNormalize(Object.assign({}, state.settings, patch));
    applySettings(state.settings);
  });

  window.__CleanRead__ = {
    toggle: toggle,
    close: deactivate,
    isActive: function () {
      return state.active;
    },
  };

  activate();
})();
