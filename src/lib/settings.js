/* CleanRead — cấu hình dùng chung cho reader và popup.
 * Chỉ dùng `var` và `function` để file có thể được inject lại nhiều lần
 * vào cùng một isolated world mà không gây lỗi khai báo trùng.
 */

var CLEANREAD_DEFAULTS = {
  theme: "day", // day | paper | night
  font: "serif", // serif | sans
  fontSize: 19, // px
  lineHeight: 1.7,
  measure: 680, // bề ngang vùng chữ, px
  images: true,
};

var CLEANREAD_LIMITS = {
  fontSize: { min: 15, max: 28, step: 1 },
  lineHeight: { min: 1.4, max: 2.1, step: 0.05 },
  measure: { min: 520, max: 900, step: 20 },
};

var CLEANREAD_THEMES = {
  day: {
    label: "Ngày",
    paper: "#FCFBF7",
    ink: "#16181A",
    muted: "#6C7075",
    rule: "#E2E0D7",
    accent: "#175E6B",
    mark: "rgba(23, 94, 107, 0.16)",
    bar: "rgba(252, 251, 247, 0.88)",
  },
  paper: {
    label: "Giấy",
    paper: "#EDE3D0",
    ink: "#3A3126",
    muted: "#7A6B53",
    rule: "#DACBAD",
    accent: "#14565F",
    mark: "rgba(20, 86, 95, 0.18)",
    bar: "rgba(237, 227, 208, 0.9)",
  },
  night: {
    label: "Đêm",
    paper: "#14161A",
    ink: "#CDD1D4",
    muted: "#878C92",
    rule: "#272B31",
    accent: "#74BCC6",
    mark: "rgba(116, 188, 198, 0.22)",
    bar: "rgba(20, 22, 26, 0.9)",
  },
};

var CLEANREAD_FONTS = {
  serif: '"Iowan Old Style", Charter, Georgia, "Noto Serif", "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif',
};

function cleanreadNormalize(raw) {
  var s = Object.assign({}, CLEANREAD_DEFAULTS, raw || {});
  if (!CLEANREAD_THEMES[s.theme]) s.theme = CLEANREAD_DEFAULTS.theme;
  if (!CLEANREAD_FONTS[s.font]) s.font = CLEANREAD_DEFAULTS.font;
  s.fontSize = cleanreadClamp(s.fontSize, CLEANREAD_LIMITS.fontSize, CLEANREAD_DEFAULTS.fontSize);
  s.lineHeight = cleanreadClamp(s.lineHeight, CLEANREAD_LIMITS.lineHeight, CLEANREAD_DEFAULTS.lineHeight);
  s.measure = cleanreadClamp(s.measure, CLEANREAD_LIMITS.measure, CLEANREAD_DEFAULTS.measure);
  s.images = s.images !== false;
  return s;
}

function cleanreadClamp(value, limit, fallback) {
  var n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, n));
}

/* Gắn các biến CSS của một bộ cấu hình lên một element bất kỳ
 * (vùng đọc trong shadow DOM, hoặc khung xem thử trong popup). */
function cleanreadApplyVars(el, settings) {
  var theme = CLEANREAD_THEMES[settings.theme];
  el.style.setProperty("--cr-paper", theme.paper);
  el.style.setProperty("--cr-ink", theme.ink);
  el.style.setProperty("--cr-muted", theme.muted);
  el.style.setProperty("--cr-rule", theme.rule);
  el.style.setProperty("--cr-accent", theme.accent);
  el.style.setProperty("--cr-mark", theme.mark);
  el.style.setProperty("--cr-bar", theme.bar);
  el.style.setProperty("--cr-body-font", CLEANREAD_FONTS[settings.font]);
  el.style.setProperty("--cr-size", settings.fontSize + "px");
  el.style.setProperty("--cr-leading", String(settings.lineHeight));
  el.style.setProperty("--cr-measure", settings.measure + "px");
}

function cleanreadLoad(callback) {
  try {
    chrome.storage.sync.get(CLEANREAD_DEFAULTS, function (stored) {
      var err = chrome.runtime.lastError;
      callback(cleanreadNormalize(err ? null : stored));
    });
  } catch (e) {
    callback(cleanreadNormalize(null));
  }
}

function cleanreadSave(patch) {
  try {
    chrome.storage.sync.set(patch);
  } catch (e) {
    /* bỏ qua: cấu hình chỉ là tuỳ chọn hiển thị */
  }
}
