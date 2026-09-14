/* CleanRead — popup.
 * Popup không tự inject gì cả: nó gửi yêu cầu cho service worker, còn phần
 * cấu hình thì ghi thẳng vào chrome.storage để vùng đọc tự cập nhật theo. */

(function () {
  "use strict";

  var el = {
    toggle: document.getElementById("toggle"),
    note: document.getElementById("note"),
    specimen: document.getElementById("specimen"),
    themeSeg: document.getElementById("themeSeg"),
    fontSeg: document.getElementById("fontSeg"),
    fontSize: document.getElementById("fontSize"),
    fontSizeValue: document.getElementById("fontSizeValue"),
    lineHeight: document.getElementById("lineHeight"),
    lineHeightValue: document.getElementById("lineHeightValue"),
    measure: document.getElementById("measure"),
    measureValue: document.getElementById("measureValue"),
    images: document.getElementById("images"),
    reset: document.getElementById("reset"),
    shortcut: document.getElementById("shortcut"),
    shortcutLink: document.getElementById("shortcutLink"),
  };

  var settings = cleanreadNormalize(null);
  var readerActive = false;

  function setup() {
    buildSegment(el.themeSeg, Object.keys(CLEANREAD_THEMES).map(function (key) {
      return { value: key, label: CLEANREAD_THEMES[key].label };
    }), function (value) {
      change({ theme: value });
    });

    buildSegment(el.fontSeg, [
      { value: "serif", label: "Có chân", className: "chip-serif" },
      { value: "sans", label: "Không chân" },
    ], function (value) {
      change({ font: value });
    });

    bindRange(el.fontSize, CLEANREAD_LIMITS.fontSize, "fontSize");
    bindRange(el.lineHeight, CLEANREAD_LIMITS.lineHeight, "lineHeight");
    bindRange(el.measure, CLEANREAD_LIMITS.measure, "measure");

    el.images.addEventListener("change", function () {
      change({ images: el.images.checked });
    });

    el.reset.addEventListener("click", function () {
      change(Object.assign({}, CLEANREAD_DEFAULTS));
    });

    el.shortcutLink.addEventListener("click", function () {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
      window.close();
    });

    el.toggle.addEventListener("click", requestToggle);

    cleanreadLoad(function (loaded) {
      settings = loaded;
      render();
    });

    loadShortcut();
    loadState();
  }

  function buildSegment(container, options, onPick) {
    options.forEach(function (option) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (option.className ? " " + option.className : "");
      chip.textContent = option.label;
      chip.dataset.value = option.value;
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function () {
        onPick(option.value);
      });
      container.appendChild(chip);
    });
  }

  function bindRange(input, limit, key) {
    input.min = String(limit.min);
    input.max = String(limit.max);
    input.step = String(limit.step);
    input.addEventListener("input", function () {
      var patch = {};
      patch[key] = Number(input.value);
      change(patch);
    });
  }

  function change(patch) {
    settings = cleanreadNormalize(Object.assign({}, settings, patch));
    cleanreadSave(patch);
    render();
  }

  function render() {
    cleanreadApplyVars(el.specimen, settings);

    press(el.themeSeg, settings.theme);
    press(el.fontSeg, settings.font);

    el.fontSize.value = String(settings.fontSize);
    el.fontSizeValue.textContent = settings.fontSize + " px";

    el.lineHeight.value = String(settings.lineHeight);
    el.lineHeightValue.textContent = settings.lineHeight.toFixed(2);

    el.measure.value = String(settings.measure);
    el.measureValue.textContent = settings.measure + " px";

    el.images.checked = settings.images;
  }

  function press(container, value) {
    var chips = container.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute("aria-pressed", String(chips[i].dataset.value === value));
    }
  }

  function loadState() {
    chrome.runtime.sendMessage({ type: "CLEANREAD_REQUEST_STATE" }, function (response) {
      if (chrome.runtime.lastError || !response) return;
      readerActive = Boolean(response.active);
      el.toggle.textContent = readerActive ? "Tắt chế độ đọc" : "Bật chế độ đọc";
      if (!response.injectable) {
        el.toggle.disabled = true;
        showNote("Chế độ đọc chỉ dùng được trên trang web http/https.");
      }
    });
  }

  function requestToggle() {
    el.toggle.disabled = true;
    chrome.runtime.sendMessage({ type: "CLEANREAD_REQUEST_TOGGLE" }, function (response) {
      if (chrome.runtime.lastError || !response) {
        el.toggle.disabled = false;
        showNote("Không gửi được lệnh tới trang. Hãy tải lại trang rồi thử lại.");
        return;
      }
      if (!response.ok) {
        el.toggle.disabled = false;
        showNote(response.error || "Không chạy được trên trang này.");
        return;
      }
      window.close();
    });
  }

  function showNote(text) {
    el.note.textContent = text;
    el.note.hidden = false;
  }

  function loadShortcut() {
    if (!chrome.commands || !chrome.commands.getAll) return;
    chrome.commands.getAll(function (commands) {
      if (!commands) return;
      for (var i = 0; i < commands.length; i++) {
        if (commands[i].name === "toggle-reader") {
          el.shortcut.textContent = commands[i].shortcut || "Chưa đặt phím tắt";
          return;
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
