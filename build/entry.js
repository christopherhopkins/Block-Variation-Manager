/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./source/admin/variation-editor.scss":
/*!********************************************!*\
  !*** ./source/admin/variation-editor.scss ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/***/ ((module) => {

module.exports = window["React"];

/***/ }),

/***/ "@wordpress/api-fetch":
/*!**********************************!*\
  !*** external ["wp","apiFetch"] ***!
  \**********************************/
/***/ ((module) => {

module.exports = window["wp"]["apiFetch"];

/***/ }),

/***/ "@wordpress/block-editor":
/*!*************************************!*\
  !*** external ["wp","blockEditor"] ***!
  \*************************************/
/***/ ((module) => {

module.exports = window["wp"]["blockEditor"];

/***/ }),

/***/ "@wordpress/blocks":
/*!********************************!*\
  !*** external ["wp","blocks"] ***!
  \********************************/
/***/ ((module) => {

module.exports = window["wp"]["blocks"];

/***/ }),

/***/ "@wordpress/components":
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
/***/ ((module) => {

module.exports = window["wp"]["components"];

/***/ }),

/***/ "@wordpress/compose":
/*!*********************************!*\
  !*** external ["wp","compose"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["compose"];

/***/ }),

/***/ "@wordpress/data":
/*!******************************!*\
  !*** external ["wp","data"] ***!
  \******************************/
/***/ ((module) => {

module.exports = window["wp"]["data"];

/***/ }),

/***/ "@wordpress/dom-ready":
/*!**********************************!*\
  !*** external ["wp","domReady"] ***!
  \**********************************/
/***/ ((module) => {

module.exports = window["wp"]["domReady"];

/***/ }),

/***/ "@wordpress/editor":
/*!********************************!*\
  !*** external ["wp","editor"] ***!
  \********************************/
/***/ ((module) => {

module.exports = window["wp"]["editor"];

/***/ }),

/***/ "@wordpress/element":
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["element"];

/***/ }),

/***/ "@wordpress/hooks":
/*!*******************************!*\
  !*** external ["wp","hooks"] ***!
  \*******************************/
/***/ ((module) => {

module.exports = window["wp"]["hooks"];

/***/ }),

/***/ "@wordpress/i18n":
/*!******************************!*\
  !*** external ["wp","i18n"] ***!
  \******************************/
/***/ ((module) => {

module.exports = window["wp"]["i18n"];

/***/ }),

/***/ "@wordpress/plugins":
/*!*********************************!*\
  !*** external ["wp","plugins"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["plugins"];

/***/ }),

/***/ "./source/admin/orientation.js":
/*!*************************************!*\
  !*** ./source/admin/orientation.js ***!
  \*************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ORIENTATION_STORAGE_KEY: () => (/* binding */ ORIENTATION_STORAGE_KEY),
/* harmony export */   dispatchOrientationNotice: () => (/* binding */ dispatchOrientationNotice)
/* harmony export */ });
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");


const ORIENTATION_STORAGE_KEY = 'bvm-orientation-seen';
const NOTICE_ID = 'bvm-orientation';
function readDismissed() {
  try {
    return window.localStorage.getItem(ORIENTATION_STORAGE_KEY) === '1';
  } catch (_e) {
    return false;
  }
}
function writeDismissed() {
  try {
    window.localStorage.setItem(ORIENTATION_STORAGE_KEY, '1');
  } catch (_e) {
    // ignore — the notice simply reappears next load
  }
}

/**
 * Show the variation-editor orientation banner. Dismissible; dismissal
 * persists in localStorage so agency devs don't re-read the same sentence
 * every time they open a variation.
 */
function dispatchOrientationNotice(usageCount) {
  const notices = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/notices');
  if (!notices?.createNotice) return;

  // Remove any previously-shown copy so re-surfacing replaces it.
  notices.removeNotice?.(NOTICE_ID);
  if (readDismissed()) return;
  const usage = usageCount > 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)( /* translators: %d: number of pages using this variation */
  (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__._n)('Used on %d page.', 'Used on %d pages.', usageCount, 'block-variation-manager'), usageCount) : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Not used yet.', 'block-variation-manager');
  const explain = (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Saving updates every instance of this variation, except attributes overridden on a specific block.', 'block-variation-manager');
  notices.createNotice('info', `${usage} ${explain}`, {
    id: NOTICE_ID,
    isDismissible: true,
    type: 'default',
    onDismiss: writeDismissed
  });
}

/***/ }),

/***/ "./source/admin/strip-post-chrome.js":
/*!*******************************************!*\
  !*** ./source/admin/strip-post-chrome.js ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   applyVariationEditorChrome: () => (/* binding */ applyVariationEditorChrome)
/* harmony export */ });
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/**
 * Trims the standard WP post-editor chrome on the bvm_variation edit screen
 * so it reads as a "variation editor", not a page editor:
 *
 *   - Removes Document panels that don't apply (Status & visibility,
 *     Permalink, Discussion, Template, Excerpt, Featured image, Page
 *     attributes). Variations have no public URL, no discussion, no
 *     template, no scheduling — surfacing those panels is misleading.
 *   - Repoints the top-left "back to dashboard" link at the variations
 *     list (Tools → Block Variations) instead of the generic admin
 *     dashboard, so the implicit "where does this back arrow go" matches
 *     where the user came from.
 *   - Adds a body class so cosmetic CSS can scope further tweaks.
 *   - Replaces the post title placeholder ("Add title") with
 *     "Variation name" via a MutationObserver — the post title input is
 *     rendered by core and its placeholder isn't filterable.
 *
 * Implemented with DOM mutation rather than SlotFill so we don't pull in
 * @wordpress/interface (a bundled-by-default WP package; importing it
 * forces a node_modules install and inflates the bundle).
 */



const PANELS_TO_REMOVE = ['post-status', 'post-link', 'discussion-panel', 'template', 'page-attributes', 'post-excerpt', 'featured-image'];
function applyVariationEditorChrome() {
  var _editor$removeEditorP;
  document.body.classList.add('is-bvm-variation-editor');

  // removeEditorPanel moved from core/edit-post to core/editor in WP 6.5.
  // Prefer the new namespace; fall back to the old one for older builds.
  const editor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/editor');
  const editPost = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/edit-post');
  const remove = (_editor$removeEditorP = editor?.removeEditorPanel?.bind(editor)) !== null && _editor$removeEditorP !== void 0 ? _editor$removeEditorP : editPost?.removeEditorPanel?.bind(editPost);
  if (remove) {
    PANELS_TO_REMOVE.forEach(name => remove(name));
  }
  observeTitlePlaceholder();
  observeBackLink();
}
function observeTitlePlaceholder() {
  const apply = () => {
    const el = document.querySelector('.editor-post-title__input, .wp-block-post-title');
    if (!el) return false;
    el.setAttribute('placeholder', (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Variation name', 'block-variation-manager'));
    el.setAttribute('aria-label', (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Variation name', 'block-variation-manager'));
    return true;
  };
  if (apply()) return;
  // One-shot observer — disconnect as soon as we hit the title once.
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * The top-left "W" / fullscreen-close button is rendered by core as an
 * anchor pointing at admin URL or a dispatch-driven button. Across recent
 * Gutenberg versions the selector has been any of:
 *
 *   .edit-post-fullscreen-mode-close
 *   .editor-document-tools__back
 *
 * We point both at the variations list and add a tooltip label.
 */
function observeBackLink() {
  const url = window.BVM?.variationListUrl;
  if (!url) return;
  const apply = () => {
    const el = document.querySelector('.edit-post-fullscreen-mode-close, .editor-document-tools__back');
    // Some implementations render the back affordance as a <button>;
    // only mutate when it's an anchor we can safely retarget.
    if (!el || 'A' !== el.tagName) return false;
    el.setAttribute('href', url);
    el.setAttribute('aria-label', (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Block Variations', 'block-variation-manager'));
    return true;
  };
  if (apply()) return;
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/***/ }),

/***/ "./source/admin/usage-panel.js":
/*!*************************************!*\
  !*** ./source/admin/usage-panel.js ***!
  \*************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_plugins__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/plugins */ "@wordpress/plugins");
/* harmony import */ var _wordpress_editor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/editor */ "@wordpress/editor");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var _orientation_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./orientation.js */ "./source/admin/orientation.js");









const VARIATION_CPT = 'bvm_variation';
function UsagePanel() {
  const postId = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_4__.useSelect)(s => s('core/editor')?.getCurrentPostId?.(), []);
  const postType = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_4__.useSelect)(s => s('core/editor')?.getCurrentPostType?.(), []);
  const [instances, setInstances] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)(null);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)(null);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useEffect)(() => {
    if (!postId || postType !== VARIATION_CPT) return;
    let cancelled = false;
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.listInstances)(postId).then(data => {
      if (!cancelled) setInstances(data);
    }).catch(err => {
      if (!cancelled) setError(err.message || String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [postId, postType]);
  if (postType !== VARIATION_CPT) return null;
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_editor__WEBPACK_IMPORTED_MODULE_3__.PluginDocumentSettingPanel, {
    name: "bvm-usage",
    title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Usage', 'block-variation-manager'),
    className: "bvm-usage-panel"
  }, error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12"
  }, error), instances === null && !error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.Spinner, null), Array.isArray(instances) && instances.length === 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12"
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Not used on any pages yet.', 'block-variation-manager')), Array.isArray(instances) && instances.length > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "p",
    size: "12",
    weight: "600",
    style: {
      marginBottom: 6
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.sprintf)( /* translators: %d: number of pages */
  (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__._n)('Used on %d page', 'Used on %d pages', instances.length, 'block-variation-manager'), instances.length)), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("ul", {
    style: {
      margin: 0,
      padding: 0,
      listStyle: 'none'
    }
  }, instances.map(item => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("li", {
    key: item.id,
    style: {
      padding: '4px 0',
      borderBottom: '1px solid rgba(0,0,0,0.06)'
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("a", {
    href: item.edit_link || '#',
    target: "_blank",
    rel: "noopener noreferrer"
  }, item.title), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "span",
    size: "11",
    variant: "muted",
    style: {
      marginLeft: 6
    }
  }, item.post_type, 'publish' !== item.status && ` · ${item.status}`))))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("hr", {
    style: {
      margin: '12px 0'
    }
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "p",
    size: "11",
    weight: "600",
    upperCase: true
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('About this screen', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12",
    style: {
      marginTop: 4
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Saving propagates to every instance above, except attributes overridden on a specific block.', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_6__.Button, {
    variant: "link",
    onClick: () => {
      var _window$BVM$variation;
      try {
        window.localStorage.removeItem(_orientation_js__WEBPACK_IMPORTED_MODULE_8__.ORIENTATION_STORAGE_KEY);
      } catch (_e) {
        // localStorage unavailable — fine, just re-fire.
      }
      (0,_orientation_js__WEBPACK_IMPORTED_MODULE_8__.dispatchOrientationNotice)((_window$BVM$variation = window.BVM?.variationUsageCount) !== null && _window$BVM$variation !== void 0 ? _window$BVM$variation : 0);
    },
    style: {
      paddingLeft: 0
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Show orientation banner', 'block-variation-manager')));
}
(0,_wordpress_plugins__WEBPACK_IMPORTED_MODULE_2__.registerPlugin)('bvm-usage', {
  render: UsagePanel
});

/***/ }),

/***/ "./source/admin/variation-editor.js":
/*!******************************************!*\
  !*** ./source/admin/variation-editor.js ***!
  \******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/blocks */ "@wordpress/blocks");
/* harmony import */ var _wordpress_dom_ready__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/dom-ready */ "@wordpress/dom-ready");
/* harmony import */ var _orientation_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./orientation.js */ "./source/admin/orientation.js");
/* harmony import */ var _strip_post_chrome_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./strip-post-chrome.js */ "./source/admin/strip-post-chrome.js");
/* harmony import */ var _usage_panel_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./usage-panel.js */ "./source/admin/usage-panel.js");
var _window$BVM;
/**
 * Runs only on the bvm_variation post edit screen.
 *
 * Enforces "exactly one root block of the variation's block type" while
 * leaving inner blocks fully editable — so the user can build nested
 * structures inside the variation. The root block's attributes are what
 * propagate to every instance; inner blocks ride along as a template
 * that pre-populates each instance on insert (instance-local after that).
 *
 * Enforcement is purely client-side (no root templateLock) because a
 * server-side root templateLock cascades into inner blocks and defeats
 * the point.
 *
 * Also:
 * - Shows a dismissible orientation banner (see ./orientation.js).
 * - Mounts a Document sidebar panel listing every page using this
 *   variation (see ./usage-panel.js).
 */







const ctx = (_window$BVM = window.BVM) !== null && _window$BVM !== void 0 ? _window$BVM : {};
if (ctx.isVariationEditor && ctx.variationBlockType) {
  _wordpress_dom_ready__WEBPACK_IMPORTED_MODULE_2__(() => {
    (0,_strip_post_chrome_js__WEBPACK_IMPORTED_MODULE_4__.applyVariationEditorChrome)();
    initVariationEditor(ctx.variationBlockType);
    (0,_orientation_js__WEBPACK_IMPORTED_MODULE_3__.dispatchOrientationNotice)(ctx.variationUsageCount || 0);
  });
}
function initVariationEditor(blockType) {
  let reentrant = false;
  (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.subscribe)(() => {
    // IMPORTANT: @wordpress/data fires subscribers synchronously
    // inside dispatch(). resetBlocks() below would re-enter this
    // callback and blow the stack without this guard.
    if (reentrant) return;
    const blockEditor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.select)('core/block-editor');
    if (!blockEditor) return;
    const blocks = blockEditor.getBlocks();

    // Re-seed an empty editor. Happens on first load of a brand-new
    // variation, and also if the user somehow deletes the root block.
    if (blocks.length === 0) {
      reentrant = true;
      try {
        (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.dispatch)('core/block-editor').resetBlocks([(0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_1__.createBlock)(blockType)]);
      } finally {
        reentrant = false;
      }
      return;
    }

    // Prune any stray root siblings. Keeps exactly one root block of
    // the configured type. Wrong-type roots are replaced; extra roots
    // are dropped (inner blocks of the kept root are preserved).
    const first = blocks[0];
    const extraRoots = blocks.length > 1;
    const wrongType = first.name !== blockType;
    if (extraRoots || wrongType) {
      reentrant = true;
      try {
        const kept = wrongType ? (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_1__.createBlock)(blockType) : first;
        (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.dispatch)('core/block-editor').resetBlocks([kept]);
      } finally {
        reentrant = false;
      }
    }
  });
}

/***/ }),

/***/ "./source/components/VariationPanel.js":
/*!*********************************************!*\
  !*** ./source/components/VariationPanel.js ***!
  \*********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VariationPanel)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/blocks */ "@wordpress/blocks");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var _lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../lib/block-registry.js */ "./source/lib/block-registry.js");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");











/** Sentinel cache key used to re-render on any variation-store invalidation. */
const STORE_TICK_KEY = -1;
function useVariationsForBlock(blockName) {
  const [list, setList] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.subscribe, () => (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.getCached)(STORE_TICK_KEY));
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    let cancelled = false;
    setError(null);
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.listForBlockType)(blockName).then(data => {
      if (!cancelled) setList(data);
    }).catch(err => {
      if (!cancelled) setError(err.message || String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [blockName]);
  return {
    list,
    error
  };
}
function useVariationSnapshot(variationId) {
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.ensureVariationLoaded)(variationId);
  }, [variationId]);
  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.subscribe, () => variationId ? (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.getCached)(variationId) : null);
}
function extractPresetAttrs(attributes) {
  const out = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (_constants_js__WEBPACK_IMPORTED_MODULE_9__.INTERNAL_ATTRS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Recursively shape a tree of editor block objects into the
 * { name, attributes, innerBlocks } payload the REST endpoint stores.
 * Strips BVM bookkeeping attrs and undefined values.
 */
function shapeInnerBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(b => b && typeof b.name === 'string' && b.name !== '').map(b => {
    var _b$attributes;
    return {
      name: b.name,
      attributes: extractPresetAttrs((_b$attributes = b.attributes) !== null && _b$attributes !== void 0 ? _b$attributes : {}),
      innerBlocks: shapeInnerBlocks(b.innerBlocks)
    };
  });
}

/** Kadence class-pair convention: `fooClass` ↔ `foo`. */
function kadenceClassPair(key) {
  if (key.endsWith('Class') && key.length > 5) {
    return key.slice(0, -5);
  }
  return key + 'Class';
}

/** Base key for a class-pair — strips `Class` suffix when present. */
function pairBaseKey(key) {
  return key.endsWith('Class') && key.length > 5 ? key.slice(0, -5) : key;
}

/**
 * Collapse class-pair overrides into a single entry keyed by the base name.
 * e.g. ['bgColor','bgColorClass','minHeight'] → ['bgColor','minHeight'].
 */
function collapsePairs(overrides) {
  const seen = new Set();
  const out = [];
  for (const key of overrides) {
    const base = pairBaseKey(key);
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}
function noticeSuccess(message) {
  const notices = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.dispatch)('core/notices');
  notices?.createNotice?.('success', message, {
    type: 'snackbar',
    isDismissible: true
  });
}

/**
 * Recursively turn [name, attrs, innerBlocks] tuples (the shape we persist
 * in _bvm_variation_inner_blocks) into a tree of block objects ready for
 * replaceInnerBlocks(). createBlock()'s third arg wants block objects, not
 * tuples, so the recursion is necessary.
 */
function tuplesToBlocks(template) {
  if (!Array.isArray(template)) return [];
  return template.map(([name, attrs, inner]) => (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_5__.createBlock)(name, attrs && typeof attrs === 'object' ? attrs : {}, tuplesToBlocks(inner)));
}
function SourcePanel({
  attributes,
  setAttributes,
  clientId,
  list,
  listError,
  openInitial
}) {
  const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID] || 0;
  const overrides = Array.isArray(attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]) ? attributes[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES] : [];
  const activeVariation = useVariationSnapshot(variationId);
  const [confirmUnlink, setConfirmUnlink] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(false);
  // When user picks a variation that includes inner blocks AND the live
  // block already has children, defer the assignment until they confirm
  // whether to replace or keep existing children.
  // Shape: { id, title, innerBlocks }
  const [pendingApply, setPendingApply] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const options = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => {
    const opts = [{
      label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('— None —', 'block-variation-manager'),
      value: '0'
    }];
    if (list) {
      for (const v of list) {
        opts.push({
          label: v.title,
          value: String(v.id)
        });
      }
    }
    return opts;
  }, [list]);
  const collapsedOverrides = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => collapsePairs(overrides), [overrides]);
  const isOrphaned = variationId > 0 && activeVariation === null;
  const finalizePick = (id, title, replaceChildren, sourceInner) => {
    setAttributes({
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: id,
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    });
    if (replaceChildren && clientId && Array.isArray(sourceInner)) {
      const blocks = tuplesToBlocks(sourceInner);
      (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.dispatch)('core/block-editor')?.replaceInnerBlocks?.(clientId, blocks, false);
    }
    if (id > 0) {
      noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.sprintf)( /* translators: %s: variation title */
      (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Applied variation: %s', 'block-variation-manager'), title !== null && title !== void 0 ? title : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('variation', 'block-variation-manager')));
    }
  };
  const onPickVariation = async value => {
    var _select$getBlocks;
    const id = parseInt(value, 10);
    if (id <= 0) {
      finalizePick(id, null, false, null);
      return;
    }
    const picked = list?.find(v => v.id === id);
    // We need the full variation record (cached or freshly fetched) to
    // know whether the source has inner blocks worth restoring. The
    // list endpoint already returns inner_blocks per row, but cache may
    // not be warm if the user opened the dropdown immediately.
    const loaded = await (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.ensureVariationLoaded)(id);
    const sourceInner = Array.isArray(loaded?.inner_blocks) ? loaded.inner_blocks : [];
    const existingChildren = clientId ? (_select$getBlocks = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.select)('core/block-editor')?.getBlocks?.(clientId)) !== null && _select$getBlocks !== void 0 ? _select$getBlocks : [] : [];

    // No inner blocks on the source → behave like before; attr-only sync.
    if (sourceInner.length === 0) {
      finalizePick(id, picked?.title, false, null);
      return;
    }
    // Source has inner blocks but the target is empty → restore silently.
    if (existingChildren.length === 0) {
      finalizePick(id, picked?.title, true, sourceInner);
      return;
    }
    // Both sides have children — ask before clobbering the user's work.
    setPendingApply({
      id,
      title: picked?.title,
      innerBlocks: sourceInner
    });
  };
  const onEditSource = () => {
    var _window$BVM$adminUrl;
    if (!variationId) return;
    const adminUrl = (_window$BVM$adminUrl = window.BVM?.adminUrl) !== null && _window$BVM$adminUrl !== void 0 ? _window$BVM$adminUrl : '/wp-admin/post.php';
    window.open(`${adminUrl}?post=${variationId}&action=edit`, '_blank', 'noopener,noreferrer');
  };
  const onUnlink = () => {
    setAttributes({
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: 0,
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    });
    setConfirmUnlink(false);
    noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Block unlinked from its variation.', 'block-variation-manager'));
  };

  /**
   * Reset a single override chip. The chip is keyed by the base-name
   * (pair-collapsed), so we always remove both halves of a class-pair and
   * restore both sides from the variation.
   */
  const onResetAttr = baseKey => {
    if (!activeVariation) return;
    const pair = kadenceClassPair(baseKey);
    const toRemove = new Set([baseKey, pair]);
    const next = overrides.filter(k => !toRemove.has(k));
    const update = {
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: next
    };
    for (const k of toRemove) {
      if (Object.prototype.hasOwnProperty.call(activeVariation.attrs, k)) {
        update[k] = activeVariation.attrs[k];
      }
    }
    setAttributes(update);
  };
  const onResetAll = () => {
    if (!activeVariation) return;
    const update = {
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    };
    for (const key of overrides) {
      if (Object.prototype.hasOwnProperty.call(activeVariation.attrs, key)) {
        update[key] = activeVariation.attrs[key];
      }
    }
    setAttributes(update);
    noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Reset all overrides to the variation.', 'block-variation-manager'));
  };
  const overrideCount = collapsedOverrides.length;
  const header = variationId > 0 && overrideCount > 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.sprintf)( /* translators: %d: number of overridden attributes */
  (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__._n)('Variation source · %d override', 'Variation source · %d overrides', overrideCount, 'block-variation-manager'), overrideCount) : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Variation source', 'block-variation-manager');
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
    title: header,
    initialOpen: openInitial
  }, listError && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Notice, {
    status: "error",
    isDismissible: false
  }, listError), isOrphaned && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Notice, {
    status: "warning",
    isDismissible: false
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('This block references a variation that no longer exists. Rebind below or unlink.', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.SelectControl, {
    label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Apply', 'block-variation-manager'),
    value: String(variationId),
    options: options,
    onChange: onPickVariation,
    help: list && list.length === 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('No variations yet. Style a block and save it as a variation below.', 'block-variation-manager') : undefined,
    __nextHasNoMarginBottom: true
  }), variationId > 0 && activeVariation && overrideCount > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    style: {
      marginTop: 12
    }
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalText, {
    size: "11",
    weight: "600",
    upperCase: true
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Overrides on this instance', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12",
    style: {
      marginTop: 4,
      marginBottom: 6
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Click a chip to reset that attribute to the variation value.', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalHStack, {
    wrap: true,
    spacing: 1,
    justify: "flex-start"
  }, collapsedOverrides.map(key => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    key: key,
    variant: "secondary",
    size: "compact",
    onClick: () => onResetAttr(key),
    label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.sprintf)( /* translators: %s: attribute name */
    (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Reset %s to variation', 'block-variation-manager'), key),
    showTooltip: true
  }, key, " \xD7")), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "tertiary",
    size: "compact",
    onClick: onResetAll
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Reset all overrides', 'block-variation-manager')))), variationId > 0 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Flex, {
    gap: 2,
    wrap: true,
    style: {
      marginTop: 12
    },
    justify: "flex-start"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.FlexItem, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "secondary",
    onClick: onEditSource,
    disabled: !variationId
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Edit source', 'block-variation-manager'))), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.FlexItem, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Dropdown, {
    popoverProps: {
      placement: 'bottom-end'
    },
    renderToggle: ({
      onToggle,
      isOpen
    }) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
      variant: "tertiary",
      onClick: onToggle,
      "aria-expanded": isOpen,
      disabled: confirmUnlink
    }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('More', 'block-variation-manager')),
    renderContent: ({
      onClose
    }) => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.MenuGroup, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.MenuItem, {
      isDestructive: true,
      onClick: () => {
        onClose();
        setConfirmUnlink(true);
      }
    }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Unlink from variation', 'block-variation-manager')))
  }))), confirmUnlink && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalConfirmDialog, {
    onConfirm: onUnlink,
    onCancel: () => setConfirmUnlink(false),
    confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Unlink', 'block-variation-manager')
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Unlink this block from its variation? It will keep its current values but stop receiving future updates.', 'block-variation-manager')), pendingApply && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalConfirmDialog, {
    onConfirm: () => {
      const p = pendingApply;
      setPendingApply(null);
      finalizePick(p.id, p.title, true, p.innerBlocks);
    },
    onCancel: () => {
      const p = pendingApply;
      setPendingApply(null);
      // User opted to keep existing children — apply
      // attrs only, don't touch innerBlocks.
      finalizePick(p.id, p.title, false, null);
    },
    confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Replace children', 'block-variation-manager'),
    cancelButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Keep existing children', 'block-variation-manager')
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('This variation includes child blocks. Replace this block\u2019s existing children with the variation\u2019s, or keep the current ones?', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12",
    style: {
      marginTop: 12
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Changes to the source variation propagate here automatically, except for attributes you override on this instance.', 'block-variation-manager')));
}
function SavePanel({
  attributes,
  setAttributes,
  name,
  clientId,
  list
}) {
  const [newName, setNewName] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)('');
  const [isSaving, setIsSaving] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(false);
  const [saveError, setSaveError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const [pendingConfirm, setPendingConfirm] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const trimmed = newName.trim();
  const duplicate = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useMemo)(() => list ? list.some(v => v.title.toLowerCase() === trimmed.toLowerCase()) : false, [list, trimmed]);
  const performSave = async shouldCommitPost => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const preset = extractPresetAttrs(attributes);

      // Capture the full live inner-block tree if the registry says
      // this block has required children (e.g. kadence/advancedbtn
      // with kadence/singlebtn children). Reading via getBlocks
      // gives us resolved attrs from the editor, not the lossy
      // serialized comment representation.
      let liveChildren;
      let innerBlocks;
      if (clientId && (0,_lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__.hasRequiredChildren)(name)) {
        const children = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.select)('core/block-editor')?.getBlocks?.(clientId);
        if (Array.isArray(children) && children.length > 0) {
          liveChildren = children;
          innerBlocks = shapeInnerBlocks(children);
        }
      }
      const block = (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_5__.createBlock)(name, preset, Array.isArray(liveChildren) ? liveChildren : []);
      const content = (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_5__.serialize)(block);
      const created = await (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_7__.createVariation)({
        title: trimmed,
        blockType: name,
        attrs: preset,
        content,
        innerBlocks
      });
      setAttributes({
        [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: created.id,
        [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
      });
      setNewName('');
      noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.sprintf)( /* translators: %s: variation title */
      (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Variation "%s" created.', 'block-variation-manager'), created.title));
      if (shouldCommitPost) {
        const editorStore = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.dispatch)('core/editor');
        if (editorStore?.savePost) {
          try {
            await editorStore.savePost();
          } catch (_err) {
            // Non-fatal — variation was created.
          }
        }
      }
    } catch (err) {
      setSaveError(err.message || String(err));
    } finally {
      setIsSaving(false);
      setPendingConfirm(null);
    }
  };
  const onSave = () => {
    var _editor$isEditedPostD;
    // If the post has dirty state other than our pending linkage, the
    // post-save that counts this variation as its first instance would
    // also commit everything else. Confirm before doing that.
    const editor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.select)('core/editor');
    const isDirty = (_editor$isEditedPostD = editor?.isEditedPostDirty?.()) !== null && _editor$isEditedPostD !== void 0 ? _editor$isEditedPostD : false;
    if (isDirty) {
      setPendingConfirm('dirty');
      return;
    }
    // Post is clean — we need to save after linking so the usage count
    // picks it up. No user surprise because there are no other changes.
    performSave(true);
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
    title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Save as variation', 'block-variation-manager'),
    initialOpen: false
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.TextControl, {
    label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Name', 'block-variation-manager'),
    value: newName,
    onChange: setNewName,
    placeholder: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('e.g. Brand hero', 'block-variation-manager'),
    __nextHasNoMarginBottom: true
  }), trimmed && duplicate && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Notice, {
    status: "warning",
    isDismissible: false
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('A variation with this name already exists. Saving will create a second one.', 'block-variation-manager')), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "primary",
    onClick: onSave,
    disabled: isSaving || !trimmed,
    style: {
      marginTop: 8
    }
  }, isSaving ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Saving…', 'block-variation-manager') : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Save variation', 'block-variation-manager')), saveError && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Notice, {
    status: "error",
    isDismissible: false
  }, saveError), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalText, {
    as: "p",
    variant: "muted",
    size: "12",
    style: {
      marginTop: 12
    }
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)("The current block's attributes become the new variation's defaults. You can edit it later from Tools → Block Variations.", 'block-variation-manager')), pendingConfirm === 'dirty' && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.__experimentalConfirmDialog, {
    onConfirm: () => performSave(true),
    onCancel: () => {
      // Create the variation but don't auto-save the post.
      // The block's link will persist on next manual save.
      setPendingConfirm(null);
      performSave(false);
    },
    confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Save page and variation', 'block-variation-manager'),
    cancelButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('Create variation only', 'block-variation-manager')
  }, (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_1__.__)('This page has unsaved changes. Saving the variation now will also commit those changes to the page. Proceed, or create the variation without saving the page?', 'block-variation-manager')));
}
function VariationPanel({
  attributes,
  setAttributes,
  name,
  clientId
}) {
  const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID] || 0;
  const {
    list,
    error
  } = useVariationsForBlock(name);

  // Lazy-load the block-policy registry once; cheap no-op after first call.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    (0,_lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__.ensureRegistryLoaded)();
  }, []);
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__.InspectorControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(SourcePanel, {
    attributes: attributes,
    setAttributes: setAttributes,
    clientId: clientId,
    list: list,
    listError: error,
    openInitial: variationId > 0
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(SavePanel, {
    attributes: attributes,
    setAttributes: setAttributes,
    name: name,
    clientId: clientId,
    list: list
  }));
}

/***/ }),

/***/ "./source/constants.js":
/*!*****************************!*\
  !*** ./source/constants.js ***!
  \*****************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BVM_ATTR_OVERRIDES: () => (/* binding */ BVM_ATTR_OVERRIDES),
/* harmony export */   BVM_ATTR_VARIATION_ID: () => (/* binding */ BVM_ATTR_VARIATION_ID),
/* harmony export */   INTERNAL_ATTRS: () => (/* binding */ INTERNAL_ATTRS)
/* harmony export */ });
const BVM_ATTR_VARIATION_ID = 'bvmVariationId';
const BVM_ATTR_OVERRIDES = 'bvmOverriddenAttrs';

// Attributes we should never treat as user-set overrides — they're bookkeeping.
const INTERNAL_ATTRS = new Set([BVM_ATTR_VARIATION_ID, BVM_ATTR_OVERRIDES, 'className', 'anchor', 'lock', 'metadata']);

/***/ }),

/***/ "./source/filters/extend-attributes.js":
/*!*********************************************!*\
  !*** ./source/filters/extend-attributes.js ***!
  \*********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");



/**
 * Mirror of the PHP register_block_type_args extension: add bvmVariationId
 * and bvmOverriddenAttrs to every block's attribute schema on the client,
 * so the editor knows how to serialize/deserialize them.
 */
function extendBlockAttributes(settings) {
  if (!settings.attributes) {
    settings.attributes = {};
  }
  if (!settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_VARIATION_ID]) {
    settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_VARIATION_ID] = {
      type: 'number',
      default: 0
    };
  }
  if (!settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_OVERRIDES]) {
    settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_OVERRIDES] = {
      type: 'array',
      default: [],
      items: {
        type: 'string'
      }
    };
  }
  return settings;
}
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__.addFilter)('blocks.registerBlockType', 'bvm/extend-attributes', extendBlockAttributes);

/***/ }),

/***/ "./source/filters/inject-panel.js":
/*!****************************************!*\
  !*** ./source/filters/inject-panel.js ***!
  \****************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_compose__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/compose */ "@wordpress/compose");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _components_VariationPanel_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../components/VariationPanel.js */ "./source/components/VariationPanel.js");






/**
 * Skip adding the panel to blocks we can't meaningfully vary.
 */
const BLOCKLIST = new Set(['core/freeform', 'core/missing', 'core/block' // synced pattern wrapper
]);
const withVariationPanel = (0,_wordpress_compose__WEBPACK_IMPORTED_MODULE_2__.createHigherOrderComponent)(BlockEdit => {
  return props => {
    // Don't offer the "save/apply variation" UI inside the variation
    // editor itself — that's where the variation's source block lives.
    const isVariationEditor = !!window.BVM?.isVariationEditor;
    if (isVariationEditor || BLOCKLIST.has(props.name) || !props.isSelected) {
      return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
        ...props
      });
    }
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
      ...props
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_VariationPanel_js__WEBPACK_IMPORTED_MODULE_4__["default"], {
      attributes: props.attributes,
      setAttributes: props.setAttributes,
      name: props.name,
      clientId: props.clientId
    }));
  };
}, 'withVariationPanel');
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.BlockEdit', 'bvm/inject-panel', withVariationPanel);

/***/ }),

/***/ "./source/filters/track-overrides.js":
/*!*******************************************!*\
  !*** ./source/filters/track-overrides.js ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_compose__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/compose */ "@wordpress/compose");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");
/* harmony import */ var _lib_equality_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/equality.js */ "./source/lib/equality.js");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");








/**
 * Wraps every block's Edit component to:
 *
 * 1. Sync variation → store on mount and when the variation's attrs change.
 *    For each non-overridden variation attr that differs from what's stored,
 *    write the current variation value into the block-editor store. This
 *    makes edits to the source variation propagate into open posts.
 *
 * 2. Track overrides on user edits — wrap setAttributes so that setting an
 *    attr to a value different from the variation marks it overridden;
 *    setting it back to the variation value unmarks it.
 *
 * Why sync-to-store instead of merge-as-prop:
 *   Prop-merging (passing a synthesized `attributes` prop to BlockEdit without
 *   touching the store) makes the displayed values lie to third-party controls
 *   like Kadence's color picker. The picker fires setAttributes in multiple
 *   batched calls (e.g. bgColorClass first, bgColor second). If the merge
 *   shows variation values for attrs the user hasn't touched yet, the block
 *   renders with user-bgColorClass + variation-bgColor until the second batch
 *   lands — looking as if the first click did nothing. Writing real values
 *   into the store keeps all Kadence internal state consistent from the start.
 *
 *   The tradeoff: syncing dirties the post. That's acceptable — if the
 *   variation has genuinely changed since the post was last saved, the user
 *   should save to persist the updated values.
 */
function useVariation(variationId) {
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    if (variationId) {
      (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.ensureVariationLoaded)(variationId);
    }
  }, [variationId]);
  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.subscribe, () => variationId ? (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.getCached)(variationId) : null);
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Kadence (and some other WP block libs) store color-like attributes as a
 * pair: `fooColor` holds the palette slug/hex, `fooColorClass` holds the CSS
 * class. User interactions in the color picker often fire the two halves in
 * separate setAttributes calls. Without pairing, the first call marks only
 * one half as overridden — confusing for the user.
 *
 * Given an attr name, return any variation-controlled "class pair" siblings
 * that should move together with it.
 */
function kadenceClassPair(key) {
  if (key.endsWith('Class') && key.length > 5) {
    return key.slice(0, -5);
  }
  return key + 'Class';
}
const withVariationOverrides = (0,_wordpress_compose__WEBPACK_IMPORTED_MODULE_2__.createHigherOrderComponent)(BlockEdit => {
  return props => {
    var _variation$attrs;
    const {
      attributes,
      setAttributes
    } = props;
    const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_4__.BVM_ATTR_VARIATION_ID] || 0;
    const variation = useVariation(variationId);
    const variationAttrs = (_variation$attrs = variation?.attrs) !== null && _variation$attrs !== void 0 ? _variation$attrs : {};
    const overriddenList = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => Array.isArray(attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_4__.BVM_ATTR_OVERRIDES]) ? attributes[_constants_js__WEBPACK_IMPORTED_MODULE_4__.BVM_ATTR_OVERRIDES] : [], [attributes]);

    // Keep the latest references reachable from the sync effect without
    // making it re-run on every attribute change.
    const attributesRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useRef)(attributes);
    attributesRef.current = attributes;
    const overriddenRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useRef)(overriddenList);
    overriddenRef.current = overriddenList;
    const setAttributesRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useRef)(setAttributes);
    setAttributesRef.current = setAttributes;

    // Fingerprint of the variation's attrs — re-sync only when these change,
    // not on every keystroke in the post.
    const variationAttrsKey = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => variation ? JSON.stringify(variationAttrs) : '', [variation, variationAttrs]);
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
      var _attributesRef$curren;
      if (!variationId || !variation) return;
      const current = (_attributesRef$curren = attributesRef.current) !== null && _attributesRef$curren !== void 0 ? _attributesRef$curren : {};
      const overriddenSet = new Set(overriddenRef.current);
      const update = {};
      for (const [key, value] of Object.entries(variationAttrs)) {
        if (_constants_js__WEBPACK_IMPORTED_MODULE_4__.INTERNAL_ATTRS.has(key)) continue;
        if (overriddenSet.has(key)) continue;
        if (!(0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_5__.deepEqual)(current[key], value)) {
          update[key] = value;
        }
      }
      if (Object.keys(update).length > 0) {
        setAttributesRef.current(update);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variationId, variationAttrsKey]);
    const wrappedSetAttributes = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useCallback)(next => {
      if (!variationId || !variation) {
        setAttributes(next);
        return;
      }
      const changed = {
        ...next
      };
      const overrides = new Set(overriddenList);
      for (const key of Object.keys(next)) {
        if (_constants_js__WEBPACK_IMPORTED_MODULE_4__.INTERNAL_ATTRS.has(key)) continue;
        const hasVariationValue = Object.prototype.hasOwnProperty.call(variationAttrs, key);
        if (!hasVariationValue) {
          continue;
        }
        if ((0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_5__.deepEqual)(next[key], variationAttrs[key])) {
          overrides.delete(key);
        } else {
          overrides.add(key);
          // Kadence fires bgColor + bgColorClass in separate
          // setAttributes calls. Mark the pair together so the
          // user sees a single consistent override state after
          // the first click instead of half a chip set.
          const pair = kadenceClassPair(key);
          if (Object.prototype.hasOwnProperty.call(variationAttrs, pair)) {
            overrides.add(pair);
          }
        }
      }
      const newOverrides = Array.from(overrides).sort();
      if (!arraysEqual(newOverrides, overriddenList)) {
        changed[_constants_js__WEBPACK_IMPORTED_MODULE_4__.BVM_ATTR_OVERRIDES] = newOverrides;
      }
      setAttributes(changed);
    }, [variationId, variation, variationAttrs, overriddenList, setAttributes]);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
      ...props,
      setAttributes: wrappedSetAttributes
    });
  };
}, 'withVariationOverrides');
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.BlockEdit', 'bvm/track-overrides', withVariationOverrides);

/***/ }),

/***/ "./source/lib/block-registry.js":
/*!**************************************!*\
  !*** ./source/lib/block-registry.js ***!
  \**************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ensureRegistryLoaded: () => (/* binding */ ensureRegistryLoaded),
/* harmony export */   hasRequiredChildren: () => (/* binding */ hasRequiredChildren),
/* harmony export */   isPresetCapable: () => (/* binding */ isPresetCapable),
/* harmony export */   requiredChildren: () => (/* binding */ requiredChildren)
/* harmony export */ });
/* harmony import */ var _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/api-fetch */ "@wordpress/api-fetch");


/**
 * REST-backed mirror of the PHP BlockRegistry.
 *
 * Loaded lazily on first access. Used by SavePanel (decide whether to capture
 * inner blocks) and SourcePanel (decide whether to prompt before replacing
 * existing children on apply).
 */

let cache = null;
let inflight = null;
const EMPTY = {
  required_children: [],
  preset_capable: false
};
function ensureRegistryLoaded() {
  var _inflight, _window$BVM$restNames;
  if (cache || inflight) return (_inflight = inflight) !== null && _inflight !== void 0 ? _inflight : Promise.resolve(cache);
  inflight = _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: `/${(_window$BVM$restNames = window.BVM?.restNamespace) !== null && _window$BVM$restNames !== void 0 ? _window$BVM$restNames : 'bvm/v1'}/registry`
  }).then(data => {
    cache = data && typeof data === 'object' ? data : {};
    inflight = null;
    return cache;
  }).catch(() => {
    cache = {};
    inflight = null;
    return cache;
  });
  return inflight;
}
function entry(blockName) {
  var _cache$blockName;
  if (!cache) return EMPTY;
  return (_cache$blockName = cache[blockName]) !== null && _cache$blockName !== void 0 ? _cache$blockName : EMPTY;
}
function hasRequiredChildren(blockName) {
  const e = entry(blockName);
  return Array.isArray(e.required_children) && e.required_children.length > 0;
}
function requiredChildren(blockName) {
  const e = entry(blockName);
  return Array.isArray(e.required_children) ? e.required_children : [];
}
function isPresetCapable(blockName) {
  return Boolean(entry(blockName).preset_capable);
}

/***/ }),

/***/ "./source/lib/equality.js":
/*!********************************!*\
  !*** ./source/lib/equality.js ***!
  \********************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deepEqual: () => (/* binding */ deepEqual)
/* harmony export */ });
/**
 * Shallow-ish equality check good enough for comparing block attribute values.
 * Handles primitives, arrays, and plain objects up to reasonable depth.
 */
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/***/ }),

/***/ "./source/lib/variation-store.js":
/*!***************************************!*\
  !*** ./source/lib/variation-store.js ***!
  \***************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createVariation: () => (/* binding */ createVariation),
/* harmony export */   ensureVariationLoaded: () => (/* binding */ ensureVariationLoaded),
/* harmony export */   fetchVariation: () => (/* binding */ fetchVariation),
/* harmony export */   getCached: () => (/* binding */ getCached),
/* harmony export */   invalidateList: () => (/* binding */ invalidateList),
/* harmony export */   listForBlockType: () => (/* binding */ listForBlockType),
/* harmony export */   listInstances: () => (/* binding */ listInstances),
/* harmony export */   subscribe: () => (/* binding */ subscribe),
/* harmony export */   updateVariation: () => (/* binding */ updateVariation)
/* harmony export */ });
/* harmony import */ var _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/api-fetch */ "@wordpress/api-fetch");

const listeners = new Set();
const cache = new Map(); // id -> variation object
const listCache = new Map(); // block_type -> array
let inflightLists = new Map(); // block_type -> Promise

function notify() {
  for (const fn of listeners) {
    fn();
  }
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getCached(id) {
  var _cache$get;
  return (_cache$get = cache.get(id)) !== null && _cache$get !== void 0 ? _cache$get : null;
}
async function fetchVariation(id) {
  var _window$BVM$restNames;
  if (!id) {
    return null;
  }
  const path = `/${(_window$BVM$restNames = window.BVM?.restNamespace) !== null && _window$BVM$restNames !== void 0 ? _window$BVM$restNames : 'bvm/v1'}/variations/${id}`;
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path
  });
  cache.set(id, data);
  notify();
  return data;
}
function ensureVariationLoaded(id) {
  if (!id) {
    return Promise.resolve(null);
  }
  if (cache.has(id)) {
    return Promise.resolve(cache.get(id));
  }
  return fetchVariation(id).catch(() => {
    // Variation deleted or inaccessible — remember the null so we don't retry forever.
    cache.set(id, null);
    notify();
    return null;
  });
}
async function listForBlockType(blockType) {
  var _window$BVM$restNames2;
  if (listCache.has(blockType)) {
    return listCache.get(blockType);
  }
  if (inflightLists.has(blockType)) {
    return inflightLists.get(blockType);
  }
  const promise = _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: `/${(_window$BVM$restNames2 = window.BVM?.restNamespace) !== null && _window$BVM$restNames2 !== void 0 ? _window$BVM$restNames2 : 'bvm/v1'}/variations?block_type=${encodeURIComponent(blockType)}`
  }).then(data => {
    listCache.set(blockType, data);
    for (const variation of data) {
      cache.set(variation.id, variation);
    }
    inflightLists.delete(blockType);
    notify();
    return data;
  }).catch(err => {
    inflightLists.delete(blockType);
    throw err;
  });
  inflightLists.set(blockType, promise);
  return promise;
}
async function listInstances(variationId) {
  var _window$BVM$restNames3;
  if (!variationId) return [];
  const path = `/${(_window$BVM$restNames3 = window.BVM?.restNamespace) !== null && _window$BVM$restNames3 !== void 0 ? _window$BVM$restNames3 : 'bvm/v1'}/variations/${variationId}/instances`;
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path
  });
  return Array.isArray(data?.instances) ? data.instances : [];
}
function invalidateList(blockType) {
  if (blockType) {
    listCache.delete(blockType);
  } else {
    listCache.clear();
  }
  notify();
}
async function createVariation({
  title,
  blockType,
  attrs,
  content,
  innerBlocks
}) {
  var _window$BVM$restNames4;
  const body = {
    title,
    block_type: blockType,
    attrs,
    content
  };
  if (Array.isArray(innerBlocks)) {
    body.inner_blocks = innerBlocks;
  }
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: `/${(_window$BVM$restNames4 = window.BVM?.restNamespace) !== null && _window$BVM$restNames4 !== void 0 ? _window$BVM$restNames4 : 'bvm/v1'}/variations`,
    method: 'POST',
    data: body
  });
  cache.set(data.id, data);
  invalidateList(blockType);
  return data;
}
async function updateVariation(id, payload) {
  var _window$BVM$restNames5;
  const body = {};
  if ('title' in payload) body.title = payload.title;
  if ('attrs' in payload) body.attrs = payload.attrs;
  if ('innerBlocks' in payload) body.inner_blocks = payload.innerBlocks;
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: `/${(_window$BVM$restNames5 = window.BVM?.restNamespace) !== null && _window$BVM$restNames5 !== void 0 ? _window$BVM$restNames5 : 'bvm/v1'}/variations/${id}`,
    method: 'PUT',
    data: body
  });
  cache.set(data.id, data);
  invalidateList(data.block_type);
  return data;
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./source/entry.js ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _filters_extend_attributes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./filters/extend-attributes.js */ "./source/filters/extend-attributes.js");
/* harmony import */ var _filters_track_overrides_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./filters/track-overrides.js */ "./source/filters/track-overrides.js");
/* harmony import */ var _filters_inject_panel_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./filters/inject-panel.js */ "./source/filters/inject-panel.js");
/* harmony import */ var _admin_variation_editor_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./admin/variation-editor.js */ "./source/admin/variation-editor.js");
/* harmony import */ var _admin_variation_editor_scss__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./admin/variation-editor.scss */ "./source/admin/variation-editor.scss");
// Entry point for the Block Variation Manager editor bundle.
// Loaded via enqueue_block_editor_assets (see includes/class-assets.php).






})();

/******/ })()
;
//# sourceMappingURL=entry.js.map